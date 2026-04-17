import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

/**
 * Cron handler. Protected by a bearer token. For now it only invalidates
 * cache tags; the actual ingest pipeline (Phase A) will call this after it
 * has written fresh odds and predictions rows. Running the endpoint manually
 * is a legitimate recovery path if a user sees stale data.
 *
 * Usage:
 *   curl -H "Authorization: Bearer $CRON_SECRET" /api/cron?target=odds
 */
export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const target = url.searchParams.get("target") ?? "all";

  const invalidated: string[] = [];
  const tags = target === "all" ? ["odds", "predictions", "events", "elo"] : [target];
  for (const t of tags) {
    revalidateTag(t, "max");
    invalidated.push(t);
  }

  return NextResponse.json({ ok: true, invalidated });
}
