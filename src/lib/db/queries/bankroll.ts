import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { bankroll } from "@/lib/db/schema";

/**
 * Latest balance from the ledger. Uncached on purpose — if a bet was placed
 * 2s ago the user expects to see the new balance immediately.
 */
export async function currentBalance(): Promise<number> {
  const rows = await db
    .select({ balanceAfter: bankroll.balanceAfter })
    .from(bankroll)
    .orderBy(desc(bankroll.createdAt))
    .limit(1);
  return rows[0] ? Number(rows[0].balanceAfter) : 0;
}

export async function recentLedger(limit = 50) {
  return db
    .select()
    .from(bankroll)
    .orderBy(desc(bankroll.createdAt))
    .limit(limit);
}
