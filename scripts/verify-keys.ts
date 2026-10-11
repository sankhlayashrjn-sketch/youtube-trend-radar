import { config } from "dotenv";
import { appendFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { GoogleGenAI } from "@google/genai";
import { Resend } from "resend";

config({ path: ".env.local" });
const required = ["YOUTUBE_API_KEY", "GEMINI_API_KEY", "RESEND_API_KEY", "DATABASE_URL"];
const rows: { name: string; result: string }[] = [];
const ok = (name: string, d = "") => rows.push({ name, result: "PASS " + d });
const bad = (name: string, e: unknown) =>
  rows.push({
    name,
    result: "FAIL " + String((e as Error)?.message ?? e).replace(/key=[^&\s]+/gi, "key=***").slice(0, 160),
  });

async function main() {
  if (!existsSync(".env.local")) {
    console.log("NO .env.local");
    process.exit(2);
  }
  console.log("present:", required.filter((k) => process.env[k]).join(", ") || "none");
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) console.log("MISSING:", missing.join(", "));
  if (!process.env.CRON_SECRET) {
    appendFileSync(".env.local", `\nCRON_SECRET=${randomBytes(32).toString("hex")}\n`);
    console.log("CRON_SECRET generated and appended");
  }
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const embModel = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";

  try {
    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=id&id=dQw4w9WgXcQ&key=${process.env.YOUTUBE_API_KEY}`,
    );
    if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 100)}`);
    ok("YouTube", "videos.list (1 unit)");
  } catch (e) {
    bad("YouTube", e);
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const r = await ai.models.generateContent({ model, contents: "Reply with the single word: pong" });
    ok("Gemini Flash", `${model} -> ${(r.text ?? "").trim().slice(0, 20)}`);
  } catch (e) {
    bad("Gemini Flash", e);
  }
  try {
    const r = await ai.models.embedContent({
      model: embModel,
      contents: "hello",
      config: { outputDimensionality: 768 },
    });
    ok("Gemini embed", `${embModel} dims=${r.embeddings?.[0]?.values?.length}`);
  } catch (e) {
    bad("Gemini embed", e);
  }

  try {
    const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
    await sql`select 1`;
    await sql.end();
    ok("Database", "select 1");
  } catch (e) {
    bad("Database", e);
  }

  if (process.argv.includes("--email")) {
    try {
      const to = process.env.TEST_EMAIL_TO;
      if (!to) throw new Error("set TEST_EMAIL_TO");
      const r = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: "Trend Radar <onboarding@resend.dev>",
        to,
        subject: "Trend Radar key test",
        html: "<p>Resend works.</p>",
      });
      if (r.error) throw new Error(r.error.message);
      ok("Resend", "sent");
    } catch (e) {
      bad("Resend", e);
    }
  }
  console.table(rows);
}
main();
