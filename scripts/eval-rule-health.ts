// Rule health test (Round 2 promise: find the 3 vague rules planted in the demo rules; stop repeated false alarms).
import { PGlite } from "@electric-sql/pglite";
import { scoreAll, applyFalseAlarms, normQuote, type FeedbackRow } from "../src/lib/rule-health";
import { SCHEMA_SQL } from "../src/lib/schema";
import { seedRuleHistoryWith, PLANTED_VAGUE } from "../src/lib/rule-history";
import { RULES } from "../src/lib/seed-data";

(async () => {
  // build the same seeded history the app uses, in an in-memory database
  const pg = new PGlite();
  await pg.exec(SCHEMA_SQL);
  await seedRuleHistoryWith(async (t: string, p: unknown[] = []) => (await pg.query(t, p)).rows);
  const rows = (await pg.query<FeedbackRow>("SELECT rule_id, kind, quote, note FROM rule_feedback")).rows;
  const ids = [...new Set([...RULES.map((r) => r.id), ...rows.map((r) => r.rule_id)])];
  const health = scoreAll(ids, rows);
  console.log("Lowest clarity scores:");
  for (const h of health.slice(0, 6)) console.log(`  ${h.ruleId.padEnd(6)} ${String(h.score).padStart(3)}/100  ${h.status.padEnd(9)}  ${h.why}`);
  const found = health.filter((h) => h.status === "unclear" || h.status === "attention").map((h) => h.ruleId);
  const hit = PLANTED_VAGUE.filter((id) => found.includes(id));
  const extra = found.filter((id) => !PLANTED_VAGUE.includes(id));
  console.log(`\nPlanted vague rules found: ${hit.length}/${PLANTED_VAGUE.length} (${hit.join(", ")})   Clear rules wrongly flagged: ${extra.length}${extra.length ? " (" + extra.join(", ") + ")" : ""}`);

  // false-alarm memory: same rule + same wording is hidden; other wording and must-fix issues are not
  const alarms = (await pg.query<{ rule_id: string; quote_norm: string }>("SELECT rule_id, quote_norm FROM false_alarms")).rows;
  const tests = [
    { sources: [{ id: "V-04" }], quote: "Hi there,", severity: "minor", want: "hidden" },
    { sources: [{ id: "V-04" }], quote: "hi there", severity: "minor", want: "hidden" },
    { sources: [{ id: "V-04" }], quote: "Hey babes", severity: "minor", want: "kept" },
    { sources: [{ id: "V-02" }], quote: "Hi there,", severity: "major", want: "kept" },
    { sources: [{ id: "M-03" }], quote: "Worth every rupee!", severity: "minor", want: "hidden" },
    { sources: [{ id: "V-01" }], quote: "We get it, breakouts are annoying.", severity: "blocker", want: "kept" },
  ];
  const { hidden } = applyFalseAlarms(tests, alarms);
  let ok = 0;
  for (const t of tests) { const got = hidden.includes(t) ? "hidden" : "kept"; if (got === t.want) ok++; console.log(`  ${t.sources[0].id} "${t.quote}" (${t.severity}) → ${got}${got === t.want ? "" : "  ✗ expected " + t.want}`); }
  console.log(`False-alarm memory cases correct: ${ok}/${tests.length}`);
  // repeat-rate on the seeded history: how many past false alarms would be raised again
  const fp = rows.filter((r) => r.kind === "false_positive");
  const again = applyFalseAlarms(fp.map((r) => ({ sources: [{ id: r.rule_id }], quote: r.quote, severity: "minor" })), alarms).kept.length;
  console.log(`Repeated false alarms on the history: ${fp.length} before → ${again} after`);
  process.exit(0);
})();
