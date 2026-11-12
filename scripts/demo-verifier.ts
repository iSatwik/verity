import { runPipeline } from "../src/lib/check";
import { seedCanon } from "./canon-from-seed";
(async () => {
  const r = await runPipeline(seedCanon(), { text: "Hey gorgeous! Say goodbye to dull skin. Our team is busy with Project Kesar, call 9876543210.", channel: "instagram" }, (l) => console.log("AI LOG:", l.purpose, l.model, JSON.stringify(l.redacted_input)));
  for (const f of r.findings.filter((f) => f.method !== "code")) console.log(`[${f.severity}] ${f.method} ${f.title} | "${f.quote}" | ${f.message}`);
  console.log("intent:", r.intent, "redactions:", r.redactions);
})();
