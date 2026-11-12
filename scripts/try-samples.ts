import { SAMPLES } from "../src/lib/seed-data";
import { runPipeline } from "../src/lib/check";
import { seedCanon } from "./canon-from-seed";
(async () => {
  const canon = seedCanon();
  for (const s of SAMPLES) {
    const r = await runPipeline(canon, { text: s.text, channel: s.channel, imageText: s.imageText ?? null });
    console.log(`\n=== ${s.key} ${s.title} (${r.findings.length})  intent: ${r.intent.goal} | ${r.intent.cta}`);
    for (const f of r.findings) console.log(` [${f.severity}] ${f.location}/${f.category} ${f.title} | "${f.quote}" -> ${JSON.stringify(f.suggestion)} | ${f.sources.map((x) => x.id).join(",")}`);
  }
})();
