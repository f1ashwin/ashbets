/**
 * Env var preflight.
 *
 * Run before `npm run dev` or any migration/seed script. Surfaces missing or
 * obviously-placeholder values with a pointed message instead of letting the
 * app fail later with a confusing postgres error. Optional vars warn but
 * don't fail.
 *
 * Reads `.env.local` via Node's built-in --env-file support:
 *   $ node --env-file=.env.local --import tsx scripts/verify-env.ts
 * or simply:
 *   $ npm run check:env
 */

interface EnvEntry {
  name: string;
  hint: string;
  /** Substrings that mean the value is still the example placeholder. */
  placeholders?: string[];
}

const REQUIRED: EnvEntry[] = [
  {
    name: "DATABASE_URL",
    hint: "Supabase → Project Settings → Database → Connection string",
    placeholders: ["your-project", "password@db"],
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    hint: "Supabase → Project Settings → API",
    placeholders: ["your-project"],
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    hint: "Supabase → Project Settings → API → anon public key",
    placeholders: ["eyJ..."],
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    hint: "Supabase → Project Settings → API → service_role key",
    placeholders: ["eyJ..."],
  },
  {
    name: "UPSTASH_REDIS_REST_URL",
    hint: "Upstash console → DB → REST API tab",
    placeholders: ["https://...", "..."],
  },
  {
    name: "UPSTASH_REDIS_REST_TOKEN",
    hint: "Upstash console → DB → REST API tab",
    placeholders: ["..."],
  },
  {
    name: "CRON_SECRET",
    hint: "Any random 32+ char string. `openssl rand -hex 32` works.",
    placeholders: ["your_random_secret_here"],
  },
];

const RECOMMENDED: EnvEntry[] = [
  {
    name: "ODDS_API_KEY",
    hint: "the-odds-api.com — needed before first ingest run",
    placeholders: ["your_key_here"],
  },
  {
    name: "API_FOOTBALL_KEY",
    hint: "api-sports.io — needed for team stats + H2H lookups",
    placeholders: ["your_key_here"],
  },
  {
    name: "CRICKET_DATA_API_KEY",
    hint: "cricketdata.org — needed for cricket ingest",
    placeholders: ["your_key_here"],
  },
];

function check(entry: EnvEntry): { kind: "ok" | "missing" | "placeholder"; detail?: string } {
  const raw = process.env[entry.name];
  if (raw === undefined || raw === "") return { kind: "missing" };
  const lower = raw.toLowerCase();
  for (const p of entry.placeholders ?? []) {
    if (lower.includes(p.toLowerCase())) {
      return { kind: "placeholder", detail: p };
    }
  }
  return { kind: "ok" };
}

let hardErrors = 0;
let softWarnings = 0;

console.log("Environment preflight:\n");
console.log("  EnvEntry:");
for (const r of REQUIRED) {
  const res = check(r);
  if (res.kind === "ok") {
    console.log(`    ✓ ${r.name}`);
  } else if (res.kind === "missing") {
    console.log(`    ✗ ${r.name} — not set. Source: ${r.hint}`);
    hardErrors++;
  } else {
    console.log(
      `    ✗ ${r.name} — still the placeholder ("${res.detail}"). Source: ${r.hint}`
    );
    hardErrors++;
  }
}

console.log("\n  Recommended (needed before Phase A ingest):");
for (const r of RECOMMENDED) {
  const res = check(r);
  if (res.kind === "ok") {
    console.log(`    ✓ ${r.name}`);
  } else {
    console.log(`    ! ${r.name} — ${res.kind}. ${r.hint}`);
    softWarnings++;
  }
}

if (hardErrors > 0) {
  console.error(
    `\n✗ ${hardErrors} required var(s) missing or left as placeholder. ` +
      `Fill .env.local and re-run.`
  );
  process.exit(1);
}

if (softWarnings > 0) {
  console.log(
    `\n✓ All required vars set. ${softWarnings} API key(s) still missing — fill before ingest runs.`
  );
  process.exit(0);
}

console.log("\n✓ All env vars present.");
