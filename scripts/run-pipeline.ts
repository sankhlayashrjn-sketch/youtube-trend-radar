import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { runFullPipeline } = await import("../src/lib/pipeline");
  const { writeFileSync, mkdirSync } = await import("node:fs");
  const email = process.argv.includes("--email");
  const res = await runFullPipeline({ manual: false, email });
  if (res.error) console.log("ERROR:", res.error);
  if (res.brief) {
    console.log("headline:", res.brief.headline);
    console.log("themes:", res.brief.themes.map((t) => `${t.name} [${t.urgency.level}] ${t.stats.creatorCount} creators`));
    console.log("meta:", res.brief.meta);
    if (process.argv.includes("--seed") && !res.error) {
      mkdirSync("seed", { recursive: true });
      writeFileSync("seed/brief.json", JSON.stringify({ ...res.brief, meta: { ...res.brief.meta, dataSource: "seed" } }, null, 2));
      console.log("wrote seed/brief.json");
    }
  }
  process.exit(res.error ? 1 : 0);
}
main();
