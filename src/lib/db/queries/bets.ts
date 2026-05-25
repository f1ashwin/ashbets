import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { betLegs, bets, clvTracking } from "@/lib/db/schema";

/** Recent bets with CLV info for the bet tracker. Uncached — user-specific. */
export async function listRecentBets(limit = 200) {
  const rows = await db
    .select({
      bet: bets,
      clv: clvTracking,
    })
    .from(bets)
    .leftJoin(clvTracking, eq(clvTracking.betId, bets.id))
    .orderBy(desc(bets.placedAt))
    .limit(limit);
  return rows;
}

export async function getBetWithLegs(betId: string) {
  const betRow = await db.select().from(bets).where(eq(bets.id, betId)).limit(1);
  if (!betRow[0]) return null;
  const legs = await db.select().from(betLegs).where(eq(betLegs.betId, betId));
  return { bet: betRow[0], legs };
}

/** Paper vs real spend totals for today, used by the daily-cap guard. */
export async function todaysSpend(now: Date = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rows = await db
    .select({ stake: bets.stake, paperOnly: bets.paperOnly, placedAt: bets.placedAt })
    .from(bets);

  let real = 0;
  let paper = 0;
  for (const r of rows) {
    if (r.placedAt < start) continue;
    const stake = Number(r.stake);
    if (r.paperOnly) paper += stake;
    else real += stake;
  }
  return { real, paper };
}
