import { getPredictionsForToday } from "@/lib/db/queries/predictions";
import { getLatestOddsForEvents } from "@/lib/db/queries/odds";
import { currentBalance } from "@/lib/db/queries/bankroll";
import { evaluateValue, recommendedStake } from "@/lib/predictions/value-calculator";
import { limits } from "@/lib/config/limits";

export interface MoonshotBet {
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  startTime: Date;
  market: "h2h" | "totals";
  selection: string;
  selectionLabel: string;
  bookmaker: string;
  odds: number;
  edge: number;
  ev: number;
  modelProbability: number;
  stake: number;
}

const MOONSHOT_MIN_ODDS = 4.0;
const MOONSHOT_MIN_EDGE = 0.05;

export async function getDailyMoonshots(): Promise<MoonshotBet[]> {
  const preds = await getPredictionsForToday("football");
  if (preds.length === 0) return [];

  const eventIds = preds.map((p) => p.eventId);
  const oddsRows = await getLatestOddsForEvents(eventIds);
  const bankroll = await currentBalance();

  // Group odds by event and build companion map: eventId → "bookmaker:market" → { outcome → odds }
  const oddsByEvent = new Map<string, typeof oddsRows>();
  for (const o of oddsRows) {
    const list = oddsByEvent.get(o.eventId) ?? [];
    list.push(o);
    oddsByEvent.set(o.eventId, list);
  }

  const moonshots: MoonshotBet[] = [];

  for (const p of preds) {
    const eventOdds = oddsByEvent.get(p.eventId) ?? [];
    if (eventOdds.length === 0) continue;

    // Build companion map for vig stripping
    const companionMap: Record<string, Record<string, number>> = {};
    for (const o of eventOdds) {
      const k = `${o.bookmaker}:${o.market}`;
      if (!companionMap[k]) companionMap[k] = {};
      companionMap[k][o.outcome] = o.odds;
    }

    for (const o of eventOdds) {
      if (o.odds < MOONSHOT_MIN_ODDS) continue;

      let modelProb = 0;
      if (o.market === "h2h") {
        modelProb = p.probabilities[o.outcome] ?? 0;
      } else if (o.market === "totals") {
        if (o.outcome === "over") modelProb = p.probabilities.over25 ?? 0;
        else if (o.outcome === "under") modelProb = p.probabilities.under25 ?? 0;
      } else {
        continue;
      }

      const companionOdds = Object.values(companionMap[`${o.bookmaker}:${o.market}`] ?? {});
      const signal = evaluateValue(modelProb, o.odds, o.bookmaker, o.outcome, companionOdds);

      if (!signal.isValue || signal.edge < MOONSHOT_MIN_EDGE) continue;

      let selectionLabel: string;
      if (o.market === "h2h") {
        if (o.outcome === "home") selectionLabel = p.event.homeTeam;
        else if (o.outcome === "away") selectionLabel = p.event.awayTeam;
        else selectionLabel = "Draw";
      } else {
        selectionLabel = o.outcome === "over" ? "Over 2.5 Goals" : "Under 2.5 Goals";
      }

      const stakeResult = recommendedStake(signal.kellyFraction, bankroll, {
        softCap: limits.softCap,
        hardCap: limits.hardCap,
        maxBetCurrency: limits.maxDailyStakeEur / 4,
      });

      moonshots.push({
        eventId: p.eventId,
        homeTeam: p.event.homeTeam,
        awayTeam: p.event.awayTeam,
        startTime: p.event.startTime,
        market: o.market as "h2h" | "totals",
        selection: o.outcome,
        selectionLabel,
        bookmaker: o.bookmaker,
        odds: o.odds,
        edge: signal.edge,
        ev: signal.ev,
        modelProbability: signal.modelProbability,
        stake: Math.round(stakeResult.stake * 100) / 100,
      });
    }
  }

  // Sort by EV descending, return top 2
  return moonshots.sort((a, b) => b.ev - a.ev).slice(0, 2);
}
