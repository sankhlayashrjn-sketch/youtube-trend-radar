import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // MIGRATION_URL (session pooler, port 5432) is an optional fallback if 6543 fails.
  dbCredentials: { url: (process.env.MIGRATION_URL || process.env.DATABASE_URL)! },
});
