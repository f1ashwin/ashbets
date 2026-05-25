CREATE TABLE "bankroll" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"balance_after" numeric(10, 2) NOT NULL,
	"bet_id" uuid,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid,
	"sport" text NOT NULL,
	"bet_type" text DEFAULT 'single' NOT NULL,
	"market" text NOT NULL,
	"selection" text NOT NULL,
	"bookmaker" text NOT NULL,
	"stake" numeric(10, 2) NOT NULL,
	"odds" numeric(10, 4) NOT NULL,
	"potential_return" numeric(10, 2),
	"status" text DEFAULT 'pending' NOT NULL,
	"profit_loss" numeric(10, 2),
	"closing_odds" numeric(10, 4),
	"clv" numeric(10, 4),
	"model_probability" numeric(6, 4),
	"edge_percent" numeric(6, 2),
	"notes" text,
	"tags" text[],
	"paper_only" boolean DEFAULT true NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "clv_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bet_id" uuid NOT NULL,
	"odds_taken" numeric(10, 4) NOT NULL,
	"closing_odds" numeric(10, 4) NOT NULL,
	"clv_percentage" numeric(10, 4) NOT NULL,
	"is_positive_clv" boolean NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "elo_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity" text NOT NULL,
	"sport" text NOT NULL,
	"rating" numeric(8, 2) DEFAULT '1500' NOT NULL,
	"peak_rating" numeric(8, 2),
	"matches_played" integer DEFAULT 0 NOT NULL,
	"last_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_mapping" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_event_id" uuid NOT NULL,
	"odds_api_id" text,
	"api_football_id" text,
	"cricket_data_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"source" text NOT NULL,
	"sport" text NOT NULL,
	"league" text,
	"home_team" text NOT NULL,
	"away_team" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"result" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "odds_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"bookmaker" text NOT NULL,
	"market" text NOT NULL,
	"outcome" text NOT NULL,
	"odds" numeric(10, 4) NOT NULL,
	"point" numeric(6, 2),
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sport" text NOT NULL,
	"source" text NOT NULL,
	"external_id" text,
	"external_name" text NOT NULL,
	"suggested_team_id" uuid,
	"suggested_score" numeric(5, 4),
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"model" text NOT NULL,
	"probabilities" jsonb NOT NULL,
	"best_value" jsonb,
	"pinnacle_edge" numeric(6, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"source" text NOT NULL,
	"external_id" text,
	"external_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_stats_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sport" text NOT NULL,
	"team" text NOT NULL,
	"season" text NOT NULL,
	"stats" jsonb NOT NULL,
	"source" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sport" text NOT NULL,
	"canonical_name" text NOT NULL,
	"country" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bankroll" ADD CONSTRAINT "bankroll_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bets" ADD CONSTRAINT "bets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clv_tracking" ADD CONSTRAINT "clv_tracking_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_mapping" ADD CONSTRAINT "event_mapping_canonical_event_id_events_id_fk" FOREIGN KEY ("canonical_event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odds_history" ADD CONSTRAINT "odds_history_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_aliases" ADD CONSTRAINT "pending_aliases_suggested_team_id_teams_id_fk" FOREIGN KEY ("suggested_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_aliases" ADD CONSTRAINT "team_aliases_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bankroll_created_at_idx" ON "bankroll" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bets_status_idx" ON "bets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bets_placed_at_idx" ON "bets" USING btree ("placed_at");--> statement-breakpoint
CREATE INDEX "bets_sport_idx" ON "bets" USING btree ("sport");--> statement-breakpoint
CREATE INDEX "clv_bet_id_idx" ON "clv_tracking" USING btree ("bet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "elo_entity_sport_idx" ON "elo_ratings" USING btree ("entity","sport");--> statement-breakpoint
CREATE UNIQUE INDEX "event_mapping_canonical_idx" ON "event_mapping" USING btree ("canonical_event_id");--> statement-breakpoint
CREATE INDEX "event_mapping_odds_api_idx" ON "event_mapping" USING btree ("odds_api_id");--> statement-breakpoint
CREATE INDEX "event_mapping_api_football_idx" ON "event_mapping" USING btree ("api_football_id");--> statement-breakpoint
CREATE INDEX "event_mapping_cricket_data_idx" ON "event_mapping" USING btree ("cricket_data_id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_external_source_idx" ON "events" USING btree ("external_id","source");--> statement-breakpoint
CREATE INDEX "events_sport_idx" ON "events" USING btree ("sport");--> statement-breakpoint
CREATE INDEX "events_start_time_idx" ON "events" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "odds_event_bookmaker_idx" ON "odds_history" USING btree ("event_id","bookmaker","market","outcome");--> statement-breakpoint
CREATE UNIQUE INDEX "pending_aliases_unique_idx" ON "pending_aliases" USING btree ("source","external_name");--> statement-breakpoint
CREATE INDEX "predictions_event_idx" ON "predictions" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_aliases_source_name_idx" ON "team_aliases" USING btree ("source","external_name");--> statement-breakpoint
CREATE INDEX "team_aliases_team_idx" ON "team_aliases" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stats_cache_unique_idx" ON "team_stats_cache" USING btree ("sport","team","season","source");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_sport_name_idx" ON "teams" USING btree ("sport","canonical_name");