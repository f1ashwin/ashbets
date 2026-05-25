DROP INDEX "team_aliases_source_name_idx";--> statement-breakpoint
DROP INDEX "event_mapping_odds_api_idx";--> statement-breakpoint
DROP INDEX "event_mapping_api_football_idx";--> statement-breakpoint
DROP INDEX "event_mapping_cricket_data_idx";--> statement-breakpoint
DROP INDEX "pending_aliases_unique_idx";--> statement-breakpoint
ALTER TABLE "team_aliases" ADD COLUMN "sport" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "team_aliases_sport_source_name_idx" ON "team_aliases" USING btree ("sport","source","external_name");--> statement-breakpoint
CREATE UNIQUE INDEX "event_mapping_odds_api_idx" ON "event_mapping" USING btree ("odds_api_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_mapping_api_football_idx" ON "event_mapping" USING btree ("api_football_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_mapping_cricket_data_idx" ON "event_mapping" USING btree ("cricket_data_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pending_aliases_unique_idx" ON "pending_aliases" USING btree ("sport","source","external_name");