"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { bankroll, betLegs, bets, oddsHistory } from "@/lib/db/schema";
import { currentBalance } from "@/lib/db/queries/bankroll";
import { todaysSpend } from "@/lib/db/queries/bets";
import { limits } from "@/lib/config/limits";
import { recommendedStake } from "@/lib/predictions/value-calculator";
import type { ComboRecommendation } from "@/lib/predictions/combo";

export interface SinglePlacement {
  kind: "single";
  eventId: string;
  sport: "football" | "cricket";
  market: string;
  selection: string;
  outcome: string;
  bookmaker: string;
  odds: number;
  modelProbability: number;
  edge: number;
  stake: number;
}

export interface ComboPlacement {
  kind: "combo";
  combo: ComboRecommendation;
  stake: number;
}

export type PlaceBetInput = SinglePlacement | ComboPlacement;

export type PlaceBetResult =
  | { ok: true; betId: string; paperOnly: boolean; stakeApplied: number }
  | { ok: false; error: string };

const LINE_MOVE_TOLERANCE = 0.01; // 1%

export async function placeBet(input: PlaceBetInput): Promise<PlaceBetResult> {
  if (input.stake <= 0) {
    return { ok: false, error: "stake must be positive" };
  }

  const balance = await currentBalance();
  const spend = await todaysSpend();
  const dailyRemaining = Math.max(0, limits.maxDailyStakeEur - spend.real);

  const stakeCap = recommendedStake(Infinity, balance, {
    softCap: limits.softCap,
    hardCap: limits.hardCap,
    dailyRemaining,
    maxBetCurrency: limits.maxDailyStakeEur,
  });

  if (input.stake > stakeCap.stake && limits.backtestGatePassed) {
    return { ok: false, error: `stake above cap (${stakeCap.boundBy})` };
  }
  const trimmedStake = Math.min(input.stake, stakeCap.stake);

  // Line-move guard (singles only).
  if (input.kind === "single") {
    const latest = await db
      .select()
      .from(oddsHistory)
      .where(
        and(
          eq(oddsHistory.eventId, input.eventId),
          eq(oddsHistory.bookmaker, input.bookmaker),
          eq(oddsHistory.market, input.market),
          eq(oddsHistory.outcome, input.outcome)
        )
      )
      .orderBy(desc(oddsHistory.recordedAt))
      .limit(1);
    const latestOdds = latest[0] ? Number(latest[0].odds) : input.odds;
    const drift = Math.abs(latestOdds - input.odds) / input.odds;
    if (drift > LINE_MOVE_TOLERANCE) {
      return { ok: false, error: "line moved — re-evaluate before placing" };
    }
  }

  const paperOnly = !limits.backtestGatePassed;

  const betId = await db.transaction(async (tx) => {
    if (input.kind === "single") {
      const [row] = await tx
        .insert(bets)
        .values({
          eventId: input.eventId,
          sport: input.sport,
          betType: "single",
          legCount: 1,
          market: input.market,
          selection: input.selection,
          bookmaker: input.bookmaker,
          stake: String(trimmedStake),
          odds: String(input.odds),
          potentialReturn: String(trimmedStake * input.odds),
          modelProbability: String(input.modelProbability),
          edgePercent: String(input.edge * 100),
          paperOnly,
        })
        .returning({ id: bets.id });

      await tx.insert(bankroll).values({
        type: "bet_placed",
        amount: String(paperOnly ? 0 : -trimmedStake),
        balanceAfter: String(paperOnly ? balance : balance - trimmedStake),
        betId: row.id,
        description: `${input.sport} single — ${input.selection}`,
      });

      return row.id;
    }

    // Combo
    const combo = input.combo;
    const firstLeg = combo.legs[0];
    const [row] = await tx
      .insert(bets)
      .values({
        eventId: null,
        sport: firstLeg.sport,
        betType: "accumulator",
        legCount: combo.legs.length,
        combinedOdds: String(combo.combinedOdds),
        market: "accumulator",
        selection: combo.legs.map((l) => l.label).join(" + "),
        bookmaker: firstLeg.bookmaker,
        stake: String(trimmedStake),
        odds: String(combo.combinedOdds),
        potentialReturn: String(trimmedStake * combo.combinedOdds),
        modelProbability: String(combo.combinedProbability),
        edgePercent: String(combo.combinedEV * 100),
        paperOnly,
      })
      .returning({ id: bets.id });

    for (const leg of combo.legs) {
      await tx.insert(betLegs).values({
        betId: row.id,
        eventId: leg.eventId,
        market: "h2h",
        selection: leg.outcome,
        odds: String(leg.odds),
        modelProbability: String(leg.modelProbability),
      });
    }

    await tx.insert(bankroll).values({
      type: "bet_placed",
      amount: String(paperOnly ? 0 : -trimmedStake),
      balanceAfter: String(paperOnly ? balance : balance - trimmedStake),
      betId: row.id,
      description: `${combo.kind} combo — ${combo.legs.length} legs`,
    });

    return row.id;
  });

  revalidateTag("bets", "max");
  revalidatePath("/");

  return { ok: true, betId, paperOnly, stakeApplied: trimmedStake };
}
