/**
 * Apply drizzle migrations against the configured DATABASE_URL.
 *
 * This exists as a thin wrapper over `drizzle-orm/postgres-js/migrator` so
 * the same connection config we use at runtime is used at migration time.
 * `npx drizzle-kit push` and `drizzle-kit migrate` work too, but this path
 * gives us a clear exit code for CI + a consistent connection string source.
 *
 *   $ npm run db:migrate
 */

import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example → .env.local and fill it.");
  process.exit(1);
}

async function run() {
  // Migrations need a dedicated single-shot connection, not a pool.
  const sql = postgres(url!, { max: 1 });
  const db = drizzle(sql);
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("✓ Migrations applied.");
  } finally {
    await sql.end();
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("✗ Migration failed:", err);
    process.exit(1);
  });
