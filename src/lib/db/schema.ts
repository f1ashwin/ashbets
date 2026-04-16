import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  integer,
  jsonb,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// Unified events across all sports
export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    externalId: text("external_id").notNull(),
    source: text("source").notNull(), // 'odds-api' | 'api-football' | 'cricketdata'
    sport: text("sport").notNull(), // 'football' | 'cricket'
    league: text("league"),
    homeTeam: text("home_team").notNull(),
    awayTeam: text("away_team").notNull(),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    status: text("status").default("upcoming").notNull(), // upcoming | live | completed | cancelled
    result: jsonb("result"), // final score / result data
    metadata: jsonb("metadata"), // sport-specific extra data
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("events_external_source_idx").on(table.externalId, table.source),
    index("events_sport_idx").on(table.sport),
    index("events_start_time_idx").on(table.startTime),
  ]
);

// Historical odds snapshots for movement tracking
export const oddsHistory = pgTable(
  "odds_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .references(() => events.id, { onDelete: "cascade" })
      .notNull(),
    bookmaker: text("bookmaker").notNull(),
    market: text("market").notNull(), // h2h | spreads | totals | moneyline
    outcome: text("outcome").notNull(), // home | away | draw | over | under
    odds: numeric("odds", { precision: 10, scale: 4 }).notNull(),
    point: numeric("point", { precision: 6, scale: 2 }), // spread/total line
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("odds_event_bookmaker_idx").on(
      table.eventId,
      table.bookmaker,
      table.market,
      table.outcome
    ),
  ]
);

// User's placed bets
export const bets = pgTable(
  "bets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id").references(() => events.id), // nullable for manual bets
    sport: text("sport").notNull(),
    betType: text("bet_type").notNull().default("single"), // single | accumulator
    market: text("market").notNull(),
    selection: text("selection").notNull(), // what was bet on
    bookmaker: text("bookmaker").notNull(),
    stake: numeric("stake", { precision: 10, scale: 2 }).notNull(),
    odds: numeric("odds", { precision: 10, scale: 4 }).notNull(),
    potentialReturn: numeric("potential_return", { precision: 10, scale: 2 }),
    status: text("status").default("pending").notNull(), // pending | won | lost | void | cashout
    profitLoss: numeric("profit_loss", { precision: 10, scale: 2 }),
    closingOdds: numeric("closing_odds", { precision: 10, scale: 4 }), // for CLV tracking
    clv: numeric("clv", { precision: 10, scale: 4 }), // closing line value
    modelProbability: numeric("model_probability", { precision: 6, scale: 4 }), // our model's estimate
    edgePercent: numeric("edge_percent", { precision: 6, scale: 2 }), // edge at time of bet
    notes: text("notes"),
    tags: text("tags").array(),
    placedAt: timestamp("placed_at", { withTimezone: true }).defaultNow().notNull(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
  },
  (table) => [
    index("bets_status_idx").on(table.status),
    index("bets_placed_at_idx").on(table.placedAt),
    index("bets_sport_idx").on(table.sport),
  ]
);

// Bankroll transaction ledger
export const bankroll = pgTable(
  "bankroll",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: text("type").notNull(), // deposit | withdrawal | bet_placed | bet_settled | adjustment
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    balanceAfter: numeric("balance_after", { precision: 10, scale: 2 }).notNull(),
    betId: uuid("bet_id").references(() => bets.id),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("bankroll_created_at_idx").on(table.createdAt)]
);

// Cached stats from APIs and scraping
export const teamStatsCache = pgTable(
  "team_stats_cache",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sport: text("sport").notNull(),
    team: text("team").notNull(),
    season: text("season").notNull(),
    stats: jsonb("stats").notNull(), // flexible per sport
    source: text("source").notNull(), // api-football | fbref | ufcstats | cricketdata
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("stats_cache_unique_idx").on(
      table.sport,
      table.team,
      table.season,
      table.source
    ),
  ]
);

// Elo ratings per entity
export const eloRatings = pgTable(
  "elo_ratings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entity: text("entity").notNull(), // team or fighter name (normalized)
    sport: text("sport").notNull(),
    rating: numeric("rating", { precision: 8, scale: 2 }).default("1500").notNull(),
    peakRating: numeric("peak_rating", { precision: 8, scale: 2 }),
    matchesPlayed: integer("matches_played").default(0).notNull(),
    lastUpdated: timestamp("last_updated", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("elo_entity_sport_idx").on(table.entity, table.sport)]
);

// Model prediction outputs
export const predictions = pgTable(
  "predictions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .references(() => events.id, { onDelete: "cascade" })
      .notNull(),
    model: text("model").notNull(), // elo | dixon-coles | poisson | fighter | cricket | ensemble
    probabilities: jsonb("probabilities").notNull(), // { home: 0.55, draw: 0.25, away: 0.20 }
    bestValue: jsonb("best_value"), // { outcome: 'home', bookmaker: 'bet365', odds: 2.1, edge: 0.05 }
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("predictions_event_idx").on(table.eventId)]
);

// Closing line value tracking
export const clvTracking = pgTable(
  "clv_tracking",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    betId: uuid("bet_id")
      .references(() => bets.id, { onDelete: "cascade" })
      .notNull(),
    oddsTaken: numeric("odds_taken", { precision: 10, scale: 4 }).notNull(),
    closingOdds: numeric("closing_odds", { precision: 10, scale: 4 }).notNull(),
    clvPercentage: numeric("clv_percentage", { precision: 10, scale: 4 }).notNull(),
    isPositiveClv: boolean("is_positive_clv").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("clv_bet_id_idx").on(table.betId)]
);
