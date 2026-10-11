import {
  pgTable, text, integer, bigint, doublePrecision, timestamp, jsonb, serial, uuid, index,
} from "drizzle-orm/pg-core";

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  categories: jsonb("categories").$type<string[]>().notNull().default([]),
  region: text("region").notNull().default("IN"),
  email: text("email").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const videos = pgTable(
  "videos",
  {
    id: text("id").notNull(),
    weekId: text("week_id").notNull(),
    title: text("title").notNull(),
    channel: text("channel").notNull(),
    channelId: text("channel_id").notNull(),
    views: bigint("views", { mode: "number" }).notNull().default(0),
    likes: bigint("likes", { mode: "number" }).notNull().default(0),
    comments: bigint("comments", { mode: "number" }).notNull().default(0),
    durationSec: integer("duration_sec").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    velocity: doublePrecision("velocity").notNull().default(0),
    engagement: doublePrecision("engagement").notNull().default(0),
    region: text("region").notNull(),
    settingsHash: text("settings_hash").notNull().default(""),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    embedding: jsonb("embedding").$type<number[]>(),
  },
  (t) => [index("videos_week_idx").on(t.weekId, t.settingsHash), index("videos_id_idx").on(t.id)],
);

export const briefs = pgTable("briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  weekOf: text("week_of").notNull(),
  json: jsonb("json").notNull(),
  status: text("status").notNull().default("ok"),
  dataSource: text("data_source").notNull().default("live"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const runs = pgTable("runs", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("running"),
  stage: text("stage").notNull().default("fetching"),
  quotaUsed: integer("quota_used").notNull().default(0),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});
