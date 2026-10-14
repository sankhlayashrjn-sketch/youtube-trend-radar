import { z } from "zod";

export const urgencySchema = z.enum(["film_now", "soon", "skip"]);
export const saturationSchema = z.enum(["low", "medium", "high"]);

export const exampleVideoSchema = z.object({
  id: z.string(),
  title: z.string(),
  channel: z.string(),
  url: z.string().url(),
  publishedAt: z.string().optional(),
  views: z.number().int().nonnegative(),
  // Extra detail (older briefs don't have these)
  channelId: z.string().optional(),
  likes: z.number().int().nonnegative().optional(),
  comments: z.number().int().nonnegative().optional(),
  durationSec: z.number().int().nonnegative().optional(),
  velocity: z.number().nonnegative().optional(), // views per hour since upload
  engagement: z.number().nonnegative().optional(), // (likes+comments)/views
});

export const themeSchema = z.object({
  name: z.string().min(2).max(80),
  summary: z.string().min(10),
  whyNow: z.string().min(10),
  stats: z.object({
    creatorCount: z.number().int().min(1),
    videoCount: z.number().int().min(1),
    totalViews: z.number().nonnegative(),
    avgVelocity: z.number().nonnegative(), // views per hour
    avgEngagement: z.number().nonnegative(), // (likes+comments)/views
  }),
  winningFormat: z.string().min(3),
  typicalLengthMinutes: z.number().positive(),
  exampleVideos: z.array(exampleVideoSchema).min(1).max(8),
  filmingAngle: z.object({ title: z.string().min(3), angle: z.string().min(10) }),
  /** Short punchy text and emoji for the thumbnail (older briefs don't have this) */
  cover: z.object({ text: z.string(), emoji: z.string() }).optional(),
  urgency: z.object({ level: urgencySchema, reason: z.string().min(3) }),
  saturation: saturationSchema,
});

export const briefSchema = z.object({
  weekOf: z.string(),
  headline: z.array(z.string().min(3)).length(3),
  themes: z.array(themeSchema).min(3).max(5),
  meta: z.object({
    videoCount: z.number().int().nonnegative(),
    quotaUsed: z.number().int().nonnegative(),
    generatedAt: z.string(),
    dataSource: z.enum(["live", "cached", "seed"]),
    // What the brief was built for, so the UI can tell when settings have changed since.
    categories: z.array(z.string()).optional(),
    region: z.string().optional(),
    settingsHash: z.string().optional(),
  }),
});

export type Brief = z.infer<typeof briefSchema>;
export type Theme = z.infer<typeof themeSchema>;

/** What Gemini is allowed to write. Numbers/videos are merged in by code. */
export const aiThemeSchema = z.object({
  clusterId: z.number().int(),
  /** true only if the cluster is clearly about the tracked categories */
  onNiche: z.boolean().default(true),
  name: z.string().min(2).max(80),
  summary: z.string().min(10),
  whyNow: z.string().min(10),
  winningFormat: z.string().min(3),
  filmingTitle: z.string().min(3),
  filmingAngle: z.string().min(10),
  coverText: z.string().max(40).default(""),
  coverEmoji: z.string().max(8).default(""),
  urgency: urgencySchema,
  urgencyReason: z.string().min(3),
  saturation: saturationSchema,
});
export const aiBriefSchema = z.object({
  headline: z.array(z.string().min(3)).length(3),
  themes: z.array(aiThemeSchema).min(1).max(5),
});
export type AiBrief = z.infer<typeof aiBriefSchema>;

export const settingsSchema = z.object({
  categories: z.array(z.string().trim().min(2).max(60)).min(1, "Add at least one category").max(12, "Max 12 categories"),
  // Only regions the dropdown offers; an unsupported code would make YouTube reject every fetch.
  region: z.string().toUpperCase().refine((r) => REGIONS.some((x) => x.code === r), "Choose a supported region"),
  email: z.string().email("Enter a valid email"),
  minViews: z.number().int().min(0).max(20_000_000).default(0),
  /** Rupees the creator earns per 1,000 views; turns expected views into rough income. */
  rpm: z.number().int().min(10, "At least ₹10").max(500, "At most ₹500").default(80),
});
export type Settings = z.infer<typeof settingsSchema>;

export const REGIONS: { code: string; name: string }[] = [
  { code: "IN", name: "India" }, { code: "US", name: "United States" }, { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" }, { code: "AU", name: "Australia" }, { code: "SG", name: "Singapore" },
  { code: "AE", name: "UAE" }, { code: "DE", name: "Germany" }, { code: "BR", name: "Brazil" }, { code: "JP", name: "Japan" },
];

export type VideoRow = {
  id: string; title: string; channel: string; channelId: string;
  views: number; likes: number; comments: number; durationSec: number;
  publishedAt: Date; tags: string[]; velocity: number; engagement: number;
};

export const SCRIPT_LANGUAGES = ["English", "Hinglish"] as const;
export const scriptRequestSchema = z.object({
  briefId: z.string().uuid(),
  themeIndex: z.number().int().min(0).max(4),
  language: z.enum(SCRIPT_LANGUAGES).default("English"),
});
export const scriptSaveSchema = z.object({
  briefId: z.string().uuid(),
  themeIndex: z.number().int().min(0).max(4),
  content: z.string().max(60_000),
});
