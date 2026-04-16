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

// Canonical team identity — one row per distinct team across all data sources.
// Source-specific names flow through `team_aliases` → `teams`. All downstream
// joins (Elo, stats cache, event home/away) should use `teams.id`.
export const teams = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sport: text("sport").notNull(), // 'football' | 'cricket'
    canonicalName: text("canonical_name").notNull(),
    country: text("country"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("teams_sport_name_idx").on(table.sport, table.canonicalName),
  ]
);

// Source-specific name/id → canonical team. One alias per (sport, source, externalName).
// Sport is part of the key because upstream sources reuse names across sports
// (e.g. "Mumbai Indians" cricket team vs a hypothetical football namesake);
// without sport in the unique key, one sport's alias would silently overwrite
// the other's or point to the wrong canonical team.
export const teamAliases = pgTable(
  "team_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    sport: text("sport").notNull(), // 'football' | 'cricket'
    source: text("source").notNull(), // 'odds-api' | 'api-football' | 'cricketdata'
    externalId: text("external_id"), // nullable — some sources key only by name
    externalName: text("external_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("team_aliases_sport_source_name_idx").on(
      table.sport,
      table.source,
      table.externalName
    ),
    index("team_aliases_team_idx").on(table.teamId),
  ]
);

// Fuzzy-match candidates that the resolver could not accept automatically.
// Prediction runs refuse to proceed while any unresolved row exists for an
// involved fixture — forces explicit human triage rather than silent misjoin.
// Uniqueness is scoped by sport for the same reason as team_aliases.
export const pendingAliases = pgTable(
  "pending_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sport: text("sport").notNull(),
    source: text("source").notNull(),
    externalId: text("external_id"),
    externalName: text("external_name").notNull(),
    suggestedTeamId: uuid("suggested_team_id").references(() => teams.id),
    suggestedScore: numeric("suggested_score", { precision: 5, scale: 4 }),
    seenAt: timestamp("seen_at", { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("pending_aliases_unique_idx").on(
      table.sport,
      table.source,
      table.externalName
    ),
  ]
);

// Cross-source event mapping — lets us join a single fixture across Odds API,
// API-Football, and CricketData despite divergent IDs and team-name spellings.
export const eventMapping = pgTable(
  "event_mapping",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    canonicalEventId: uuid("canonical_event_id")
      .references(() => events.id, { onDelete: "cascade" })
      .notNull(),
    oddsApiId: text("odds_api_id"),
    apiFootballId: text("api_football_id"),
    cricketDataId: text("cricket_data_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("event_mapping_canonical_idx").on(table.canonicalEventId),
    // Upstream IDs are unique so one upstream fixture can't map to two canonical
    // events. Postgres treats NULLs as distinct by default, so rows whose ID for
    // a given source is null (the source doesn't cover that fixture) don't
    // collide with each other.
    uniqueIndex("event_mapping_odds_api_idx").on(table.oddsApiId),
    uniqueIndex("event_mapping_api_football_idx").on(table.apiFootballId),
    uniqueIndex("event_mapping_cricket_data_idx").on(table.cricketDataId),
  ]
);

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
    // true while BACKTEST_GATE_PASSED=false — bankroll rows skip real-money
    // accounting for paper bets, but CLV + settlement logic still run so we
    // can measure if model quality holds up in live conditions before scaling.
    paperOnly: boolean("paper_only").default(true).notNull(),
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
    model: text("model").notNull(), // elo | dixon-coles | cricket-form | ensemble
    probabilities: jsonb("probabilities").notNull(), // { home: 0.55, draw: 0.25, away: 0.20 }
    // bestValue stores the DE-book signal we surface to the user (Tipico/bwin/Interwetten).
    bestValue: jsonb("best_value"), // { outcome: 'home', bookmaker: 'tipico', odds: 2.1, edge: 0.05 }
    // pinnacleEdge compares the same model output to the Pinnacle closing-line
    // proxy — lets the backtest verify the model is sharp independently of the
    // placement book's margin + DE stake tax.
    pinnacleEdge: numeric("pinnacle_edge", { precision: 6, scale: 4 }),
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
