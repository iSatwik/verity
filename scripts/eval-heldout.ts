// Held-out posts written AFTER the rules were finished, with no tuning. Honest estimate of real-world accuracy.
import { runPipeline } from "../src/lib/check";
import { seedCanon } from "./canon-from-seed";
type Exp = [string, string];
const CASES: { key: string; channel: string; text: string; expect: Exp[] }[] = [
  { key: "H-1", channel: "instagram", text: "Monsoon skin feeling greasy? Our neem cleanser keeps oil in check in just 2 days. Only Rs 299 this week!!", expect: [["F-15", "2 days"], ["F-20", "Rs 299"], ["V-02", "!!"]] },
  { key: "H-2", channel: "email", text: "Dear customer, our SPF Gel is the best sunscreen for Indian skin and blocks 100% of UV rays.", expect: [["T-06", "SPF Gel"], ["C-4.2", "best"], ["C-1.1", "100% of UV rays"]] },
  { key: "H-3", channel: "ad", text: "Glow like never before! Turmeric Glow Serum with 2% turmeric and 5% niacinamide. Shop now.", expect: [] },
  { key: "H-4", channel: "press", text: "Aranya Naturals, founded in 2021, launches a new range. Our products are toxin free and loved by millions.", expect: [["T-07", "toxin free"], ["C-1.1", "loved by millions"]] },
  { key: "H-5", channel: "influencer", text: "Paid partnership with @AranyaNaturals 💚 My skin looks brighter after 3 weeks with the Turmeric Glow Serum!", expect: [["F-14", "after 3 weeks"]] },
];
(async () => {
  const canon = seedCanon(); let tp = 0, fn = 0, fp = 0;
  for (const c of CASES) {
    const r = await runPipeline(canon, { text: c.text, channel: c.channel }, () => {}, { ai: false });
    const used = new Set<number>();
    for (const e of c.expect) {
      const i = r.findings.findIndex((f, j) => !used.has(j) && f.sources.some((s) => s.id === e[0]) && (f.quote ?? "").includes(e[1]));
      if (i >= 0) { used.add(i); tp++; } else { fn++; console.log(`${c.key} MISSED ${e[0]} "${e[1]}"`); }
    }
    r.findings.forEach((f, i) => { if (!used.has(i)) { fp++; console.log(`${c.key} EXTRA [${f.severity}] ${f.title} "${f.quote}" (${f.sources.map((s) => s.id).join(",")})`); } });
  }
  console.log(`\nHeld-out: recall ${tp}/${tp + fn} = ${((tp / (tp + fn)) * 100).toFixed(0)}%, precision ${tp}/${tp + fp} = ${((tp / (tp + fp)) * 100).toFixed(0)}%`);
})();
