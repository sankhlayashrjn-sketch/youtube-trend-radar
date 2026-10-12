import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { getDatabaseUrl } from "../env";

const g = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };

function client() {
  if (!g.__sql) {
    // Supabase transaction pooler (6543) does not support prepared statements.
    g.__sql = postgres(getDatabaseUrl(), { prepare: false, max: 1, idle_timeout: 20 });
  }
  return g.__sql;
}

export const db = () => drizzle(client(), { schema });
export const sql = () => client();
export { schema };
