CREATE TABLE "scripts" (
	"id" serial PRIMARY KEY NOT NULL,
	"brief_id" uuid NOT NULL,
	"theme_index" integer NOT NULL,
	"language" text DEFAULT 'English' NOT NULL,
	"content" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "scripts_brief_theme_uq" ON "scripts" USING btree ("brief_id","theme_index");