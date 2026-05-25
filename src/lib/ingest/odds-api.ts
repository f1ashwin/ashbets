import { db } from "@/lib/db";
import { oddsHistory, events } from "@/lib/db/schema";
import { resolveEvent } from "@/lib/ingest/resolve-event";
import { getOddsApiLimiter } from "@/lib/cache/rate-limiter";

interface OddsApiResponseEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    last_update: string;
    markets: Array<{
      key: "h2h" | "totals";
      last_update: string;
      outcomes: Array<{
        name: string;
        price: number;
        point?: number;
      }>;
    }>;
  }>;
}

export interface IngestResult {
  eventsProcessed: number;
  oddsSnapshotsWritten: number;
  errors: string[];
}

export async function ingestOddsApi(): Promise<IngestResult> {
  const result: IngestResult = {
    eventsProcessed: 0,
    oddsSnapshotsWritten: 0,
    errors: [],
  };

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    result.errors.push("ODDS_API_KEY environment variable is not set.");
    return result;
  }

  // 1. Check rate limit
  try {
    const limiter = getOddsApiLimiter();
    const limitCheck = await limiter.limit("odds-api-ingest");
    if (!limitCheck.success) {
      result.errors.push("Rate limit exceeded for The Odds API.");
      return result;
    }
  } catch (err: any) {
    // If Redis is not available, we can log a warning but proceed for robustness,
    // or stop depending on strictness. Let's warn and continue.
    console.warn("Rate limiter check failed (likely Redis connection issue):", err.message);
  }

  // 2. Fetch odds from API
  // We query 'h2h' and 'totals' markets together in one call to save request quota.
  const url = `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds?regions=eu&markets=h2h,totals&oddsFormat=decimal&apiKey=${apiKey}`;

  let apiEvents: OddsApiResponseEvent[] = [];
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errText = await res.text();
      result.errors.push(`Odds API fetch failed: ${res.status} ${res.statusText} - ${errText}`);
      return result;
    }
    apiEvents = await res.json() as OddsApiResponseEvent[];
  } catch (err: any) {
    result.errors.push(`Failed to fetch from Odds API: ${err.message}`);
    return result;
  }

  const snapshotsToInsert: Array<any> = [];

  for (const event of apiEvents) {
    const commenceTime = new Date(event.commence_time);

    // Resolve team names and event canonical mappings
    try {
      const resolveResult = await resolveEvent({
        sport: "football",
        source: "odds-api",
        externalId: event.id,
        league: "FIFA World Cup",
        homeTeamName: event.home_team,
        awayTeamName: event.away_team,
        startTime: commenceTime,
      });

      if (resolveResult.status !== "matched") {
        result.errors.push(
          `Event pending resolution for ${event.home_team} vs ${event.away_team} ` +
          `(unresolved: ${resolveResult.unresolved.join(", ")}).`
        );
        continue;
      }

      const canonicalEventId = resolveResult.canonicalEventId;
      result.eventsProcessed++;

      // Process bookmakers and markets
      for (const bookie of event.bookmakers) {
        const bookieRecordedAt = new Date(bookie.last_update || Date.now());

        for (const market of bookie.markets) {
          if (market.key === "h2h") {
            for (const outcome of market.outcomes) {
              let mappedOutcome = "";
              if (outcome.name === event.home_team) {
                mappedOutcome = "home";
              } else if (outcome.name === event.away_team) {
                mappedOutcome = "away";
              } else if (outcome.name.toLowerCase() === "draw") {
                mappedOutcome = "draw";
              } else {
                continue;
              }

              snapshotsToInsert.push({
                eventId: canonicalEventId,
                bookmaker: bookie.key,
                market: "h2h",
                outcome: mappedOutcome,
                odds: String(outcome.price),
                point: null,
                recordedAt: bookieRecordedAt,
              });
            }
          } else if (market.key === "totals") {
            for (const outcome of market.outcomes) {
              // We only care about Totals 2.5 goals line
              if (outcome.point !== 2.5) continue;

              let mappedOutcome = "";
              if (outcome.name.toLowerCase() === "over") {
                mappedOutcome = "over";
              } else if (outcome.name.toLowerCase() === "under") {
                mappedOutcome = "under";
              } else {
                continue;
              }

              snapshotsToInsert.push({
                eventId: canonicalEventId,
                bookmaker: bookie.key,
                market: "totals",
                outcome: mappedOutcome,
                odds: String(outcome.price),
                point: String(outcome.point),
                recordedAt: bookieRecordedAt,
              });
            }
          }
        }
      }
    } catch (err: any) {
      result.errors.push(`Error processing event ${event.id}: ${err.message}`);
    }
  }

  // Bulk insert all gathered snapshots
  if (snapshotsToInsert.length > 0) {
    try {
      await db.insert(oddsHistory).values(snapshotsToInsert);
      result.oddsSnapshotsWritten = snapshotsToInsert.length;
    } catch (err: any) {
      result.errors.push(`Failed to bulk insert odds history: ${err.message}`);
    }
  }

  return result;
}
