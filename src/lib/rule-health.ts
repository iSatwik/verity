// Improvement 2 (Round 3): Rule health. Scores how clear each rule is from what reviewers and creators actually do
// with its warnings, drafts a clearer version, and remembers false alarms so they are not raised again.
// Pure functions here; storage is in store.ts / schema.ts.

export type FeedbackKind = "flagged" | "accepted" | "dismissed" | "unclear" | "false_positive" | "exception";
export interface FeedbackRow { rule_id: string; kind: FeedbackKind; quote: string | null; note: string | null }

export interface RuleHealth {
  ruleId: string;
  flagged: number;
  accepted: number;
  dismissed: number;
  unclear: number;
  falsePositive: number;
  exceptions: number;
  decided: number;
  score: number | null; // 0-100, null = not enough data
  status: "clear" | "attention" | "unclear" | "no_data";
  why: string;
}

export const MIN_DECISIONS = 4;

/** Clarity score: share of decisions that did NOT push back on the rule. "Rule is unclear" counts fully,
 *  a false alarm 3/4, a plain dismissal or exception 1/2 (they may be about the post, not the rule). */
export function scoreRule(ruleId: string, rows: FeedbackRow[]): RuleHealth {
  const r = rows.filter((x) => x.rule_id === ruleId);
  const n = (k: FeedbackKind) => r.filter((x) => x.kind === k).length;
  const h = { flagged: n("flagged"), accepted: n("accepted"), dismissed: n("dismissed"), unclear: n("unclear"), falsePositive: n("false_positive"), exceptions: n("exception") };
  const decided = h.accepted + h.dismissed + h.unclear + h.falsePositive + h.exceptions;
  if (decided < MIN_DECISIONS) return { ruleId, ...h, decided, score: null, status: "no_data", why: `Only ${decided} decision${decided === 1 ? "" : "s"} so far. Needs ${MIN_DECISIONS}.` };
  const pushback = h.unclear + 0.75 * h.falsePositive + 0.5 * (h.dismissed + h.exceptions);
  const score = Math.round(100 * (1 - pushback / decided));
  const status = score < 50 ? "unclear" : score < 75 ? "attention" : "clear";
  const parts: string[] = [];
  if (h.unclear) parts.push(`${h.unclear} marked "rule is unclear"`);
  if (h.falsePositive) parts.push(`${h.falsePositive} marked false alarm`);
  if (h.dismissed) parts.push(`${h.dismissed} dismissed`);
  if (h.exceptions) parts.push(`${h.exceptions} exception${h.exceptions > 1 ? "s" : ""}`);
  const why = `${h.accepted} of ${decided} warnings were accepted${parts.length ? `; ${parts.join(", ")}` : ""}.`;
  return { ruleId, ...h, decided, score, status, why };
}

export function scoreAll(ruleIds: string[], rows: FeedbackRow[]): RuleHealth[] {
  return ruleIds.map((id) => scoreRule(id, rows)).sort((a, b) => (a.score ?? 101) - (b.score ?? 101));
}

/** A clearer version of a rule, built from real cases: what people accepted (don't / do pairs) and why they pushed back.
 *  No AI needed; the admin edits and approves it before it becomes the next rules version. */
export function draftRewrite(rule: { id: string; body: string; do_example?: string | null; dont_example?: string | null }, rows: FeedbackRow[]): { body: string; do_example: string; dont_example: string; based_on: string } {
  const r = rows.filter((x) => x.rule_id === rule.id);
  const accepted = r.filter((x) => x.kind === "accepted" && x.quote);
  const pushed = r.filter((x) => (x.kind === "unclear" || x.kind === "false_positive") && x.quote);
  const dont = uniq(accepted.map((x) => x.quote!)).slice(0, 2);
  const dos = uniq(accepted.map((x) => x.note ?? "").filter(Boolean)).slice(0, 2);
  const allowed = uniq(pushed.map((x) => x.quote!)).slice(0, 2);
  const base = rule.body.replace(/\s+$/, "").replace(/\.?$/, ".");
  const lines = [base];
  const clean = (q: string) => `"${q.trim().replace(/[\s,.;:!?]+$/, "")}"`;
  if (dont.length) lines.push(`This rule is broken by wording like: ${dont.map(clean).join(", ")}.`);
  if (allowed.length) lines.push(`This is fine and should not be flagged: ${allowed.map(clean).join(", ")}.`);
  return {
    body: lines.join(" "),
    do_example: dos.length ? dos.join(" / ") : rule.do_example ?? "",
    dont_example: dont.length ? dont.join(" / ") : rule.dont_example ?? "",
    based_on: `${accepted.length} accepted fix${accepted.length === 1 ? "" : "es"} and ${pushed.length} pushback${pushed.length === 1 ? "" : "s"}`,
  };
}

function uniq(xs: string[]) { return [...new Set(xs.map((x) => x.trim()).filter(Boolean))]; }

/** Same wording = same false alarm: lower case, no punctuation, single spaces. */
export function normQuote(q: string | null | undefined): string {
  return (q ?? "").toLowerCase().replace(/[^\p{L}\p{N}₹%]+/gu, " ").trim();
}

/** Drops warnings that a person already marked as a false alarm for the same rule and the same wording. */
export function applyFalseAlarms<T extends { sources: { id: string }[]; quote?: string | null; severity: string }>(findings: T[], alarms: { rule_id: string; quote_norm: string }[]): { kept: T[]; hidden: T[] } {
  const set = new Set(alarms.map((a) => `${a.rule_id}|${a.quote_norm}`));
  const kept: T[] = [], hidden: T[] = [];
  for (const f of findings) {
    const rule = f.sources?.[0]?.id;
    // a must-fix issue is never hidden automatically: a false alarm there needs a reviewer
    if (rule && f.quote && f.severity !== "blocker" && set.has(`${rule}|${normQuote(f.quote)}`)) hidden.push(f); else kept.push(f);
  }
  return { kept, hidden };
}
