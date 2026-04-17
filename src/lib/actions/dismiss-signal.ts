"use server";

import { revalidatePath } from "next/cache";
import { getRedis } from "@/lib/cache/redis";

const DISMISS_TTL_SEC = 24 * 60 * 60;

function dismissKey(predictionId: string): string {
  return `signal:dismissed:${predictionId}`;
}

/**
 * "Not a fan" — hide this signal from the dashboard for 24h. Redis-only, no
 * DB write, since dismissals are ephemeral and don't need audit.
 */
export async function dismissSignal(predictionId: string): Promise<{ ok: true }> {
  const redis = getRedis();
  await redis.set(dismissKey(predictionId), "1", { ex: DISMISS_TTL_SEC });
  revalidatePath("/");
  return { ok: true };
}

export async function isDismissed(predictionId: string): Promise<boolean> {
  const redis = getRedis();
  const v = await redis.get<string>(dismissKey(predictionId));
  return v === "1";
}
