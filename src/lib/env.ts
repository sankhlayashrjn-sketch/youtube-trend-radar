import { z } from "zod";

const blankAsUnset = <T extends z.ZodType>(s: T) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), s);

const schema = z.object({
  YOUTUBE_API_KEY: z.string().min(10),
  GEMINI_API_KEY: z.string().min(10),
  RESEND_API_KEY: z.string().min(10),
  DATABASE_URL: z.string().url(),
  CRON_SECRET: z.string().min(16),
  // A blank value (e.g. "GEMINI_MODEL=" in a dashboard) must fall back to the default, not become an empty string.
  EMAIL_FROM: blankAsUnset(z.string().default("Trend Radar <onboarding@resend.dev>")),
  GEMINI_MODEL: blankAsUnset(z.string().default("gemini-3.8-flash")),
  GEMINI_EMBEDDING_MODEL: blankAsUnset(z.string().default("gemini-embedding-001")),
});

export type Env = z.infer<typeof schema>;

/** The database client only needs DATABASE_URL, so a missing email key must not take the dashboard down. */
export function getDatabaseUrl(): string {
  const r = z.string().url().safeParse(process.env.DATABASE_URL);
  if (!r.success) throw new Error("Invalid or missing environment variables: DATABASE_URL");
  return r.data;
}

let cached: Env | null = null;

/** Validate env lazily (so `next build` works without secrets) and never echo values. */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid or missing environment variables: ${names}`);
  }
  cached = parsed.data;
  return cached;
}
