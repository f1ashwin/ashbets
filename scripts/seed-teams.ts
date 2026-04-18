/**
 * Canonical-team seed.
 *
 * Without this bootstrap every upstream name hits `pending_aliases` on the
 * first ingest because there's nothing to fuzzy-match against. That's the
 * correct failure mode but a painful one — a single cron run on a cold DB
 * would pile up hundreds of rows for you to triage before any prediction
 * can run.
 *
 * This script writes canonical rows for the leagues we actually ingest from
 * in v1 (`SPORT_CONFIGS`). Safe to re-run: every insert uses onConflictDoNothing
 * keyed by the `(sport, canonical_name)` unique index, so a second run is a
 * no-op. Usage:
 *
 *   $ DATABASE_URL=postgres://… npx tsx scripts/seed-teams.ts
 *
 * Rosters below are current as of 2026 Premier League / Bundesliga / La Liga
 * / Serie A / Ligue 1 / IPL seasons. Teams that drop out via relegation get
 * left in place — they'll simply never match a future alias unless promoted
 * back. Teams added later via new promotion should be appended here and the
 * script re-run. Do not edit team_aliases directly from this file.
 */

import { db } from "@/lib/db";
import { teams } from "@/lib/db/schema";

type Seed = { canonicalName: string; country: string };

const FOOTBALL: Record<string, Seed[]> = {
  epl: [
    { canonicalName: "Arsenal", country: "England" },
    { canonicalName: "Aston Villa", country: "England" },
    { canonicalName: "Bournemouth", country: "England" },
    { canonicalName: "Brentford", country: "England" },
    { canonicalName: "Brighton & Hove Albion", country: "England" },
    { canonicalName: "Chelsea", country: "England" },
    { canonicalName: "Crystal Palace", country: "England" },
    { canonicalName: "Everton", country: "England" },
    { canonicalName: "Fulham", country: "England" },
    { canonicalName: "Ipswich Town", country: "England" },
    { canonicalName: "Leicester City", country: "England" },
    { canonicalName: "Liverpool", country: "England" },
    { canonicalName: "Manchester City", country: "England" },
    { canonicalName: "Manchester United", country: "England" },
    { canonicalName: "Newcastle United", country: "England" },
    { canonicalName: "Nottingham Forest", country: "England" },
    { canonicalName: "Southampton", country: "England" },
    { canonicalName: "Tottenham Hotspur", country: "England" },
    { canonicalName: "West Ham United", country: "England" },
    { canonicalName: "Wolverhampton Wanderers", country: "England" },
  ],
  bundesliga: [
    { canonicalName: "Bayern München", country: "Germany" },
    { canonicalName: "Bayer 04 Leverkusen", country: "Germany" },
    { canonicalName: "Borussia Dortmund", country: "Germany" },
    { canonicalName: "RB Leipzig", country: "Germany" },
    { canonicalName: "Eintracht Frankfurt", country: "Germany" },
    { canonicalName: "VfB Stuttgart", country: "Germany" },
    { canonicalName: "Borussia Mönchengladbach", country: "Germany" },
    { canonicalName: "VfL Wolfsburg", country: "Germany" },
    { canonicalName: "SC Freiburg", country: "Germany" },
    { canonicalName: "TSG Hoffenheim", country: "Germany" },
    { canonicalName: "FC Augsburg", country: "Germany" },
    { canonicalName: "FSV Mainz 05", country: "Germany" },
    { canonicalName: "Werder Bremen", country: "Germany" },
    { canonicalName: "Union Berlin", country: "Germany" },
    { canonicalName: "VfL Bochum", country: "Germany" },
    { canonicalName: "Holstein Kiel", country: "Germany" },
    { canonicalName: "FC St. Pauli", country: "Germany" },
    { canonicalName: "FC Heidenheim", country: "Germany" },
  ],
  laliga: [
    { canonicalName: "Real Madrid", country: "Spain" },
    { canonicalName: "FC Barcelona", country: "Spain" },
    { canonicalName: "Atlético Madrid", country: "Spain" },
    { canonicalName: "Athletic Bilbao", country: "Spain" },
    { canonicalName: "Real Sociedad", country: "Spain" },
    { canonicalName: "Villarreal", country: "Spain" },
    { canonicalName: "Real Betis", country: "Spain" },
    { canonicalName: "Sevilla FC", country: "Spain" },
    { canonicalName: "Valencia CF", country: "Spain" },
    { canonicalName: "Celta Vigo", country: "Spain" },
    { canonicalName: "Osasuna", country: "Spain" },
    { canonicalName: "Mallorca", country: "Spain" },
    { canonicalName: "Girona FC", country: "Spain" },
    { canonicalName: "Getafe", country: "Spain" },
    { canonicalName: "Rayo Vallecano", country: "Spain" },
    { canonicalName: "Espanyol", country: "Spain" },
    { canonicalName: "Deportivo Alavés", country: "Spain" },
    { canonicalName: "Real Valladolid", country: "Spain" },
    { canonicalName: "Las Palmas", country: "Spain" },
    { canonicalName: "Leganés", country: "Spain" },
  ],
  seriea: [
    { canonicalName: "Inter Milan", country: "Italy" },
    { canonicalName: "AC Milan", country: "Italy" },
    { canonicalName: "Juventus", country: "Italy" },
    { canonicalName: "Napoli", country: "Italy" },
    { canonicalName: "AS Roma", country: "Italy" },
    { canonicalName: "Lazio", country: "Italy" },
    { canonicalName: "Atalanta", country: "Italy" },
    { canonicalName: "Fiorentina", country: "Italy" },
    { canonicalName: "Bologna", country: "Italy" },
    { canonicalName: "Torino", country: "Italy" },
    { canonicalName: "Udinese", country: "Italy" },
    { canonicalName: "Genoa", country: "Italy" },
    { canonicalName: "Hellas Verona", country: "Italy" },
    { canonicalName: "Lecce", country: "Italy" },
    { canonicalName: "Cagliari", country: "Italy" },
    { canonicalName: "Empoli", country: "Italy" },
    { canonicalName: "Parma", country: "Italy" },
    { canonicalName: "Como", country: "Italy" },
    { canonicalName: "Venezia", country: "Italy" },
    { canonicalName: "Monza", country: "Italy" },
  ],
  ligue1: [
    { canonicalName: "Paris Saint-Germain", country: "France" },
    { canonicalName: "Olympique de Marseille", country: "France" },
    { canonicalName: "AS Monaco", country: "France" },
    { canonicalName: "Olympique Lyonnais", country: "France" },
    { canonicalName: "OGC Nice", country: "France" },
    { canonicalName: "LOSC Lille", country: "France" },
    { canonicalName: "Stade Rennais", country: "France" },
    { canonicalName: "RC Lens", country: "France" },
    { canonicalName: "Stade Brestois", country: "France" },
    { canonicalName: "Stade de Reims", country: "France" },
    { canonicalName: "Toulouse FC", country: "France" },
    { canonicalName: "Montpellier", country: "France" },
    { canonicalName: "Strasbourg", country: "France" },
    { canonicalName: "FC Nantes", country: "France" },
    { canonicalName: "Angers SCO", country: "France" },
    { canonicalName: "AJ Auxerre", country: "France" },
    { canonicalName: "AS Saint-Étienne", country: "France" },
    { canonicalName: "Le Havre AC", country: "France" },
  ],
};

const CRICKET: Seed[] = [
  { canonicalName: "Mumbai Indians", country: "India" },
  { canonicalName: "Chennai Super Kings", country: "India" },
  { canonicalName: "Royal Challengers Bangalore", country: "India" },
  { canonicalName: "Kolkata Knight Riders", country: "India" },
  { canonicalName: "Delhi Capitals", country: "India" },
  { canonicalName: "Rajasthan Royals", country: "India" },
  { canonicalName: "Punjab Kings", country: "India" },
  { canonicalName: "Sunrisers Hyderabad", country: "India" },
  { canonicalName: "Lucknow Super Giants", country: "India" },
  { canonicalName: "Gujarat Titans", country: "India" },
];

async function seed() {
  let football = 0;
  for (const [league, roster] of Object.entries(FOOTBALL)) {
    for (const t of roster) {
      const res = await db
        .insert(teams)
        .values({ sport: "football", canonicalName: t.canonicalName, country: t.country })
        .onConflictDoNothing()
        .returning({ id: teams.id });
      if (res[0]) football++;
    }
    console.log(`  football / ${league}: ${roster.length} in roster`);
  }

  let cricket = 0;
  for (const t of CRICKET) {
    const res = await db
      .insert(teams)
      .values({ sport: "cricket", canonicalName: t.canonicalName, country: t.country })
      .onConflictDoNothing()
      .returning({ id: teams.id });
    if (res[0]) cricket++;
  }
  console.log(`  cricket: ${CRICKET.length} in roster`);

  console.log(
    `\n✓ Seed complete. Inserted ${football} new football rows, ${cricket} new cricket rows. ` +
      `Re-runs are no-ops thanks to the unique (sport, canonical_name) index.`
  );
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
