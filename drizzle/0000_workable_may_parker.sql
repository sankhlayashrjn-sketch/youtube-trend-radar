CREATE TABLE "briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_of" text NOT NULL,
	"json" jsonb NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"data_source" text DEFAULT 'live' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"stage" text DEFAULT 'fetching' NOT NULL,
	"quota_used" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"region" text DEFAULT 'IN' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" text NOT NULL,
	"week_id" text NOT NULL,
	"title" text NOT NULL,
	"channel" text NOT NULL,
	"channel_id" text NOT NULL,
	"views" bigint DEFAULT 0 NOT NULL,
	"likes" bigint DEFAULT 0 NOT NULL,
	"comments" bigint DEFAULT 0 NOT NULL,
	"duration_sec" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"velocity" double precision DEFAULT 0 NOT NULL,
	"engagement" double precision DEFAULT 0 NOT NULL,
	"region" text NOT NULL,
	"settings_hash" text DEFAULT '' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"embedding" jsonb
);
--> statement-breakpoint
CREATE INDEX "videos_week_idx" ON "videos" USING btree ("week_id","settings_hash");--> statement-breakpoint
CREATE INDEX "videos_id_idx" ON "videos" USING btree ("id");