/**
 * World Cup 2026 team and Elo seeding.
 * Seeds the 48 nations participating in the World Cup with their initial rating values.
 *
 * Usage:
 *   $ DATABASE_URL=postgres://… npx tsx scripts/seed-teams.ts
 */

import { db } from "@/lib/db";
import { teams, eloRatings } from "@/lib/db/schema";

interface TeamSeed {
  name: string;
  country: string;
  rating: number;
}

const WORLD_CUP_TEAMS: TeamSeed[] = [
  // Elite (1800-1900) - seed rating: 1850
  { name: "Argentina", country: "Argentina", rating: 1850 },
  { name: "France", country: "France", rating: 1850 },
  { name: "England", country: "England", rating: 1850 },
  { name: "Brazil", country: "Brazil", rating: 1850 },
  { name: "Spain", country: "Spain", rating: 1850 },
  { name: "Portugal", country: "Portugal", rating: 1850 },
  { name: "Germany", country: "Germany", rating: 1850 },

  // Strong (1600-1750) - seed rating: 1680
  { name: "Netherlands", country: "Netherlands", rating: 1680 },
  { name: "Belgium", country: "Belgium", rating: 1680 },
  { name: "Croatia", country: "Croatia", rating: 1680 },
  { name: "Italy", country: "Italy", rating: 1680 },
  { name: "Uruguay", country: "Uruguay", rating: 1680 },
  { name: "USA", country: "USA", rating: 1680 },
  { name: "Morocco", country: "Morocco", rating: 1680 },
  { name: "Colombia", country: "Colombia", rating: 1680 },
  { name: "Mexico", country: "Mexico", rating: 1680 },
  { name: "Senegal", country: "Senegal", rating: 1680 },

  // Mid (1400-1600) - seed rating: 1500
  { name: "Switzerland", country: "Switzerland", rating: 1500 },
  { name: "Denmark", country: "Denmark", rating: 1500 },
  { name: "Japan", country: "Japan", rating: 1500 },
  { name: "Australia", country: "Australia", rating: 1500 },
  { name: "Iran", country: "Iran", rating: 1500 },
  { name: "South Korea", country: "South Korea", rating: 1500 },
  { name: "Saudi Arabia", country: "Saudi Arabia", rating: 1500 },
  { name: "Ecuador", country: "Ecuador", rating: 1500 },
  { name: "Canada", country: "Canada", rating: 1500 },
  { name: "Poland", country: "Poland", rating: 1500 },
  { name: "Serbia", country: "Serbia", rating: 1500 },
  { name: "Cameroon", country: "Cameroon", rating: 1500 },
  { name: "Ghana", country: "Ghana", rating: 1500 },
  { name: "Costa Rica", country: "Costa Rica", rating: 1500 },
  { name: "Tunisia", country: "Tunisia", rating: 1500 },
  { name: "Qatar", country: "Qatar", rating: 1500 },

  // Others (1300-1400) - seed rating: 1350
  { name: "Wales", country: "Wales", rating: 1350 },
  { name: "Ukraine", country: "Ukraine", rating: 1350 },
  { name: "Scotland", country: "Scotland", rating: 1350 },
  { name: "Peru", country: "Peru", rating: 1350 },
  { name: "Chile", country: "Chile", rating: 1350 },
  { name: "Egypt", country: "Egypt", rating: 1350 },
  { name: "Nigeria", country: "Nigeria", rating: 1350 },
  { name: "Algeria", country: "Algeria", rating: 1350 },
  { name: "Ivory Coast", country: "Ivory Coast", rating: 1350 },
  { name: "Turkey", country: "Turkey", rating: 1350 },
  { name: "Sweden", country: "Sweden", rating: 1350 },
  { name: "Norway", country: "Norway", rating: 1350 },
  { name: "Austria", country: "Austria", rating: 1350 },
  { name: "Hungary", country: "Hungary", rating: 1350 },
  { name: "Czech Republic", country: "Czech Republic", rating: 1350 }
];

async function seed() {
  console.log("Seeding World Cup 2026 teams and Elo ratings...");
  let teamsInserted = 0;
  let eloInserted = 0;

  for (const t of WORLD_CUP_TEAMS) {
    // 1. Insert team
    const res = await db
      .insert(teams)
      .values({
        sport: "football",
        canonicalName: t.name,
        country: t.country
      })
      .onConflictDoNothing()
      .returning({ id: teams.id });
    
    if (res[0]) teamsInserted++;

    // 2. Insert/update Elo rating
    await db
      .insert(eloRatings)
      .values({
        entity: t.name,
        sport: "football",
        rating: String(t.rating),
        peakRating: String(t.rating),
        matchesPlayed: 0
      })
      .onConflictDoUpdate({
        target: [eloRatings.entity, eloRatings.sport],
        set: {
          rating: String(t.rating),
          peakRating: String(t.rating),
          lastUpdated: new Date()
        }
      });
    eloInserted++;
  }

  console.log(`\n✓ Seed complete. Inserted ${teamsInserted} new teams, seeded ${eloInserted} Elo ratings.`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
