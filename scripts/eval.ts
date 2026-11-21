// Accuracy test: runs the code checks on a labelled set of posts and reports precision and recall.
// Run: npx tsx scripts/eval.ts
import { SAMPLES } from "../src/lib/seed-data";
import { runPipeline } from "../src/lib/check";
import { seedCanon } from "./canon-from-seed";

type Exp = [source: string, quote: string, loc?: "image"];
const CASES: { key: string; text: string; channel: string; imageText?: string; expect: Exp[]; optional?: Exp[] }[] = [
  ...SAMPLES.map((s) => ({ key: s.key, text: s.text, channel: s.channel, imageText: s.imageText })).map((c) => ({ ...c, expect: [] as Exp[], optional: [] as Exp[] })),
  { key: "E-1", channel: "instagram", text: "Try our Aloe Calm Gel: 92% aloe vera juice that soothes skin redness within 30 minutes. ₹249.", expect: [] },
  { key: "E-2", channel: "influencer", text: "#ad Loving the Turmeric Glow Serum from @AranyaNaturals. Visibly more even-toned skin in 6 weeks. Use code PRIYA10, ends 15 Nov 2026. T&C apply.", expect: [] },
  { key: "E-3", channel: "website", text: "Sun Shield SPF 30 Gel protects you from the sun with PA++++ protection.", expect: [["F-09", "SPF 30"]] },
  { key: "E-4", channel: "instagram", text: "Our Turmeric Glow Serum has 5% turmeric extract for a natural glow.", expect: [["F-08", "5% turmeric"]] },
  { key: "E-5", channel: "email", text: "Get our Neem Purifying Cleanser for ₹349 today. Free delivery on orders above ₹399.", expect: [["F-25", "₹399"]] },
  { key: "E-6", channel: "instagram", text: "Fix your ugly acne with Neem Purifying Cleanser. Visibly reduces blemishes in 4 weeks.", expect: [["T-13", "ugly"]] },
];
const K: Record<string, { expect: Exp[]; optional?: Exp[] }> = {
  "S-01": { expect: [["F-12", "3 days"], ["T-07", "chemical-free"], ["T-02", "Neem Face Wash"], ["C-4.2", "#1"], ["V-02", "Grab it NOW"], ["F-20", "₹299"], ["V-02", "!!"], ["V-02", "🌿"], ["F-12", "3 DAYS", "image"], ["F-20", "₹299", "image"], ["T-02", "neem face wash", "image"]] },
  "S-02": { expect: [["F-24", "25%"], ["C-5.2", "25%"], ["V-02", "LAST CHANCE"], ["A-02", "Click here"], ["T-03", "Aloe Vera Gel"], ["T-08", "heals"], ["C-1.2", "overnight"]] },
  "S-03": { expect: [["D-01", "Obsessed"], ["T-04", "Turmeric Serum"], ["T-10", "fair skin"], ["F-14", "in a week"], ["A-04", "#aranyanaturals"]], optional: [["C-5.2", "Use code"]] },
  "S-04": { expect: [] },
  "S-05": { expect: [["C-4.2", "best"], ["T-11", "clinically proven"], ["T-09", "100% safe"], ["F-01", "2019"], ["T-01", "Aranya Natural"], ["C-1.1", "lakhs"], ["V-07", "Yaar"]] },
  "S-06": { expect: [["CF-1", "Project Kesar"]] },
  "S-08": { expect: [["C-4.1", "Unlike other brands"], ["T-14", "repair damaged skin"]] },
  // Round 3 samples. Labels come from the mistakes planted when the posts were written; text and image are checked separately.
  "S-09": { expect: [["T-03", "Aloe Vera Gel"], ["T-08", "Heals"], ["C-1.2", "overnight"], ["T-03", "Aloe Vera Gel", "image"], ["T-08", "Heals", "image"], ["C-1.2", "overnight", "image"]] },
  "S-10": { expect: [["C-4.2", "#1"], ["C-4.1", "Unlike other brands"], ["C-4.2", "#1", "image"], ["C-4.1", "Unlike other brands", "image"]] },
  "S-11": { expect: [["D-01", "Your"], ["T-04", "Haldi Serum"], ["C-1.2", "7 days"], ["T-04", "Haldi Serum", "image"], ["C-1.2", "7 days", "image"]] },
  "S-12": { expect: [["F-20", "₹299"], ["V-02", "Jaldi karo"], ["V-02", "stock khatam"], ["V-02", "!!"], ["CF-2", "98765 43210"]] },
  "S-13": { expect: [["CF-1", "Project Kesar"], ["T-01", "Aranya Natural"], ["V-07", "bahut"]] },
  "S-14": { expect: [["F-24", "25% Off"], ["F-24", "25% off"], ["F-20", "₹299"], ["V-02", "LAST CHANCE"], ["V-02", "!!"], ["C-5.2", "25% Off"]] },
  "S-15": { expect: [] },
  "S-16": { expect: [["F-26", "100% recyclable"], ["F-26", "100% recyclable", "image"]] },
};

(async () => {
  const canon = seedCanon();
  let tp = 0, fn = 0, fp = 0, bTp = 0, bFp = 0;
  const misses: string[] = [], extras: string[] = [];
  for (const c of CASES) {
    const exp = K[c.key] ?? { expect: c.expect, optional: c.optional };
    const r = await runPipeline(canon, { text: c.text, channel: c.channel, imageText: c.imageText ?? null }, () => {}, { ai: false });
    const fs = r.findings.filter((f) => f.category !== "visual" && f.title !== "Missing alt text");
    const used = new Set<number>();
    const match = (e: Exp) => fs.findIndex((f, i) => !used.has(i) && f.sources.some((s) => s.id === e[0]) && (f.quote ?? "").includes(e[1]) && (e[2] ? f.location === "image" : f.location === "text"));
    for (const e of exp.expect) {
      const i = match(e);
      if (i >= 0) { used.add(i); tp++; if (fs[i].severity === "blocker") bTp++; } else { fn++; misses.push(`${c.key}: expected ${e[0]} on "${e[1]}"`); }
    }
    for (const e of exp.optional ?? []) { const i = match(e); if (i >= 0) used.add(i); }
    fs.forEach((f, i) => { if (!used.has(i)) { fp++; if (f.severity === "blocker") bFp++; extras.push(`${c.key}: extra [${f.severity}] ${f.title} "${f.quote}"`); } });
  }
  const p = tp / (tp + fp), rcl = tp / (tp + fn);
  console.log(`Cases: ${CASES.length}  ·  expected issues: ${tp + fn}`);
  console.log(`Recall    ${(rcl * 100).toFixed(1)}%  (${tp}/${tp + fn} expected issues found)`);
  console.log(`Precision ${(p * 100).toFixed(1)}%  (${tp}/${tp + fp} findings were correct)`);
  console.log(`Blocker precision ${((bTp / Math.max(1, bTp + bFp)) * 100).toFixed(1)}%  (${bTp}/${bTp + bFp})`);
  if (misses.length) console.log("\nMissed:\n  " + misses.join("\n  "));
  if (extras.length) console.log("\nExtra findings:\n  " + extras.join("\n  "));
})();
