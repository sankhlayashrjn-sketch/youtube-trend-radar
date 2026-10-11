import { z } from "zod";

const schema = z.object({
  YOUTUBE_API_KEY: z.string().min(10),
  GEMINI_API_KEY: z.string().min(10),
  RESEND_API_KEY: z.string().min(10),
  DATABASE_URL: z.string().url(),
  CRON_SECRET: z.string().min(16),
  EMAIL_FROM: z.string().default("Trend Radar <onboarding@resend.dev>"),
  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),
  GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
});

export type Env = z.infer<typeof schema>;

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
