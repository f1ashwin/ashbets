CREATE TABLE "bet_legs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bet_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"market" text NOT NULL,
	"selection" text NOT NULL,
	"odds" numeric(10, 4) NOT NULL,
	"model_probability" numeric(6, 4),
	"closing_odds" numeric(10, 4),
	"clv" numeric(10, 4),
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bets" ADD COLUMN "leg_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "bets" ADD COLUMN "combined_odds" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN "model_version" text;--> statement-breakpoint
ALTER TABLE "bet_legs" ADD CONSTRAINT "bet_legs_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bet_legs" ADD CONSTRAINT "bet_legs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bet_legs_bet_idx" ON "bet_legs" USING btree ("bet_id");