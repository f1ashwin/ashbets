/**
 * Team name resolver.
 *
 * Every ingest source (Odds API, API-Football, CricketData) spells team names
 * differently: "Manchester United" vs "Man Utd" vs "Manchester Utd FC". If we
 * joined on raw name strings we would silently fork one canonical team into
 * many, corrupting Elo, form, and CLV. This module is the single funnel.
 *
 * Flow:
 *   1. Exact alias lookup by (source, externalName) → matched
 *   2. Normalise name, fuzzy-match against canonical `teams` for that sport
 *   3. Score ≥ AUTO_ACCEPT_THRESHOLD → create alias, return matched
 *   4. Score ≥ SUGGEST_THRESHOLD → pending_aliases row with suggestion
 *   5. Otherwise → pending_aliases row, no suggestion
 *
 * Callers must treat "pending" as a hard stop: prediction runs refuse to
 * proceed for any fixture that has an unresolved team. Humans triage by
 * inserting into `team_aliases` directly (or marking `pending_aliases.resolvedAt`).
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { pendingAliases, teamAliases, teams } from "@/lib/db/schema";
import type { Sport } from "@/types/sports";

export type AliasSource = "odds-api" | "api-football" | "cricketdata";

export interface ResolveTeamInput {
  sport: Sport;
  source: AliasSource;
  externalId?: string | null;
  externalName: string;
}

export type ResolveTeamResult =
  | { status: "matched"; teamId: string; canonicalName: string }
  | { status: "pending"; suggestedTeamId?: string; suggestedScore?: number };

// Jaro-Winkler score at or above which we auto-create the alias.
// 0.92 is empirically tight enough to avoid false merges (e.g. "Man City" vs
// "Man Utd" scores ~0.78) while still catching common abbreviations.
const AUTO_ACCEPT_THRESHOLD = 0.92;
// Below AUTO_ACCEPT but above this, we record a suggestion for human review.
const SUGGEST_THRESHOLD = 0.8;

// Admin-style tokens that add nothing to identity ("FC Barcelona" = "Barcelona").
// These are *removed* during name expansion. "United"/"City"/etc. stay — they
// are distinguishing (Man United ≠ Man City).
const ADMIN_TOKENS = new Set([
  "fc",
  "afc",
  "sc",
  "sv",
  "rc",
  "cf",
  "sp",
  "club",
  "the",
]);

// Known abbreviation expansions. Applied *before* scoring so that
// "Manchester Utd" collapses to "manchester united" and hits the exact-match
// fast path, rather than needing fuzzy char similarity to carry the load.
const ABBREVIATIONS: Array<[RegExp, string]> = [
  [/\butd\b/g, "united"],
  [/\bst\b/g, "saint"],
  [/\bmun\b/g, "munchen"], // post-diacritic-strip form of München
];

/**
 * Normalise for fuzzy matching: lowercase, strip diacritics + punctuation,
 * collapse whitespace. Does NOT remove any tokens — that happens in `expand`.
 */
export function normaliseTeamName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalise + expand common abbreviations + drop admin tokens. The output is
 * what the scoring functions actually compare.
 */
function expand(name: string): string {
  let s = normaliseTeamName(name);
  for (const [pat, sub] of ABBREVIATIONS) s = s.replace(pat, sub);
  s = s
    .split(" ")
    .filter((tok) => tok.length > 0 && !ADMIN_TOKENS.has(tok))
    .join(" ");
  return s.replace(/\s+/g, " ").trim();
}

/** Jaccard over space-split tokens (length ≥ 2). */
function tokenJaccard(a: string, b: string): number {
  const tokens = (s: string) =>
    new Set(s.split(" ").filter((tok) => tok.length > 1));
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const tok of ta) if (tb.has(tok)) intersection++;
  const union = new Set([...ta, ...tb]).size;
  return intersection / union;
}

/**
 * Jaro similarity. Standard textbook implementation.
 * Reference: https://en.wikipedia.org/wiki/Jaro%E2%80%93Winkler_distance
 */
function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const matchDistance = Math.max(0, Math.floor(Math.max(len1, len2) / 2) - 1);
  const s1Matches = new Array<boolean>(len1).fill(false);
  const s2Matches = new Array<boolean>(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (
    (matches / len1 +
      matches / len2 +
      (matches - transpositions / 2) / matches) /
    3
  );
}

/** Jaro-Winkler adds a prefix bonus up to 4 chars at scaling 0.1. */
export function jaroWinkler(a: string, b: string): number {
  const base = jaro(a, b);
  let prefix = 0;
  const maxPrefix = Math.min(4, a.length, b.length);
  for (let i = 0; i < maxPrefix; i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return base + prefix * 0.1 * (1 - base);
}

/**
 * Score two team names for identity. Returns 0–1.
 *
 * Char-level Jaro-Winkler alone is unsafe for team names: "Manchester United"
 * and "Manchester City" share 11 chars of prefix and score ~0.93, which would
 * auto-merge them into one canonical team. We guard against that by requiring
 * token-level overlap as well.
 *
 * Rules:
 *  - If expanded names are equal → 1 (handles abbreviations like "utd"→"united")
 *  - If token Jaccard ≥ 0.5 AND Jaro-Winkler ≥ 0.88 → trust the pair, return max
 *  - If token Jaccard ≥ 0.75 alone → trust (covers long names with reorderings)
 *  - Otherwise → cap score below the auto-accept threshold so a human triages.
 *    We still return Jaro-Winkler as a *suggestion* score, capped at 0.85.
 */
export function teamNameScore(a: string, b: string): number {
  const ea = expand(a);
  const eb = expand(b);
  if (ea === eb) return 1;

  const jaccard = tokenJaccard(ea, eb);
  const jw = jaroWinkler(ea, eb);

  if (jaccard >= 0.5 && jw >= 0.88) return Math.max(jaccard, jw);
  if (jaccard >= 0.75) return jaccard;
  return Math.min(jw, 0.85);
}

interface CandidateTeam {
  id: string;
  canonicalName: string;
}

async function findBestCandidate(
  sport: Sport,
  externalName: string
): Promise<{ team: CandidateTeam; score: number } | null> {
  const rows = await db
    .select({ id: teams.id, canonicalName: teams.canonicalName })
    .from(teams)
    .where(eq(teams.sport, sport));

  let best: { team: CandidateTeam; score: number } | null = null;
  for (const row of rows) {
    const score = teamNameScore(row.canonicalName, externalName);
    if (!best || score > best.score) best = { team: row, score };
  }
  return best;
}

/**
 * Resolve a source-specific team reference to a canonical team id.
 * See module header for the full flow. Safe to call repeatedly — idempotent
 * via the unique index on (source, externalName).
 */
export async function resolveTeam(
  input: ResolveTeamInput
): Promise<ResolveTeamResult> {
  const { sport, source, externalId, externalName } = input;

  const existingAlias = await db
    .select({
      teamId: teamAliases.teamId,
      canonicalName: teams.canonicalName,
    })
    .from(teamAliases)
    .innerJoin(teams, eq(teams.id, teamAliases.teamId))
    .where(
      and(
        eq(teamAliases.source, source),
        eq(teamAliases.externalName, externalName)
      )
    )
    .limit(1);

  if (existingAlias[0]) {
    return {
      status: "matched",
      teamId: existingAlias[0].teamId,
      canonicalName: existingAlias[0].canonicalName,
    };
  }

  const candidate = await findBestCandidate(sport, externalName);

  if (candidate && candidate.score >= AUTO_ACCEPT_THRESHOLD) {
    await db
      .insert(teamAliases)
      .values({
        teamId: candidate.team.id,
        source,
        externalId: externalId ?? null,
        externalName,
      })
      .onConflictDoNothing();
    return {
      status: "matched",
      teamId: candidate.team.id,
      canonicalName: candidate.team.canonicalName,
    };
  }

  const shouldSuggest =
    candidate && candidate.score >= SUGGEST_THRESHOLD ? candidate : null;

  await db
    .insert(pendingAliases)
    .values({
      sport,
      source,
      externalId: externalId ?? null,
      externalName,
      suggestedTeamId: shouldSuggest?.team.id ?? null,
      suggestedScore: shouldSuggest
        ? String(Math.round(shouldSuggest.score * 10000) / 10000)
        : null,
    })
    .onConflictDoUpdate({
      target: [pendingAliases.source, pendingAliases.externalName],
      set: {
        suggestedTeamId: shouldSuggest?.team.id ?? null,
        suggestedScore: shouldSuggest
          ? String(Math.round(shouldSuggest.score * 10000) / 10000)
          : null,
        seenAt: sql`now()`,
      },
    });

  return {
    status: "pending",
    suggestedTeamId: shouldSuggest?.team.id,
    suggestedScore: shouldSuggest?.score,
  };
}

/**
 * Assert that both teams of a fixture resolve cleanly. Throws with a clear
 * message listing unresolved names. Prediction pipelines call this as a
 * fail-closed guard before running any model.
 */
export async function assertBothTeamsResolved(
  home: ResolveTeamInput,
  away: ResolveTeamInput
): Promise<{ homeTeamId: string; awayTeamId: string }> {
  const [h, a] = await Promise.all([resolveTeam(home), resolveTeam(away)]);
  const unresolved: string[] = [];
  if (h.status !== "matched") unresolved.push(`home="${home.externalName}"`);
  if (a.status !== "matched") unresolved.push(`away="${away.externalName}"`);
  if (unresolved.length > 0) {
    throw new Error(
      `Team name resolution failed: ${unresolved.join(", ")}. ` +
        `Check pending_aliases table and insert manual mappings into team_aliases.`
    );
  }
  return {
    homeTeamId: (h as { teamId: string }).teamId,
    awayTeamId: (a as { teamId: string }).teamId,
  };
}
