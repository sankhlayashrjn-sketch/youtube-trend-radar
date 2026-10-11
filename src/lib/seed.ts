import seedJson from "../../seed/brief.json";
import { briefSchema, type Brief } from "./types";

/** Real pre-generated brief committed to the repo so a fresh deploy always has something to show. */
export function seedBrief(): Brief | null {
  const r = briefSchema.safeParse({ ...seedJson, meta: { ...seedJson.meta, dataSource: "seed" } });
  return r.success ? r.data : null;
}
