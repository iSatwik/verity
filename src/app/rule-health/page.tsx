import { q } from "@/lib/db";
import { loadCanonWith } from "@/lib/canon";
import { currentUser } from "@/lib/session";
import { scoreAll, draftRewrite, MIN_DECISIONS, type FeedbackRow } from "@/lib/rule-health";
import { RuleHealthList } from "@/components/RuleHealthList";

export const dynamic = "force-dynamic";

export default async function RuleHealthPage() {
  const me = await currentUser();
  const [rows, alarms, canon] = await Promise.all([
    q<FeedbackRow & { created_at: string }>("SELECT rule_id, kind, quote, note, created_at FROM rule_feedback WHERE created_at > now() - interval '90 days' AND kind <> 'rewritten'"),
    q<{ id: number; rule_id: string; quote: string; created_by: string | null; created_at: string }>("SELECT id, rule_id, quote, created_by, created_at FROM false_alarms ORDER BY created_at DESC"),
    loadCanonWith(q),
  ]);
  const rewritten = await q<{ rule_id: string; created_at: string }>("SELECT rule_id, MAX(created_at)::text AS created_at FROM rule_feedback WHERE kind = 'rewritten' GROUP BY 1");
  const ids = [...new Set([...canon.rules.map((r) => r.id), ...rows.map((r) => r.rule_id)])];
  // after a rewrite, only decisions made since then count for that rule
  const since = new Map(rewritten.map((r) => [r.rule_id, new Date(r.created_at).getTime()]));
  const live = rows.filter((r) => !since.has(r.rule_id) || new Date(r.created_at).getTime() > since.get(r.rule_id)!);
  const health = scoreAll(ids, live);
  const title = (id: string) => canon.rules.find((r) => r.id === id)?.title ?? canon.terms.find((t) => t.id === id)?.note?.slice(0, 60) ?? id;
  const items = health.map((h) => {
    const rule = canon.rules.find((r) => r.id === h.ruleId);
    return {
      ...h,
      title: title(h.ruleId),
      body: rule?.body ?? null,
      rewritten: since.has(h.ruleId),
      draft: rule && (h.status === "unclear" || h.status === "attention") ? draftRewrite(rule, live) : null,
    };
  });
  const flagged = items.filter((i) => i.status === "unclear" || i.status === "attention");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">Rule health</h1>
        <p className="mt-1 max-w-3xl text-[14px] leading-relaxed text-gray-600">
          Verity learns which rules confuse people from what they do with its warnings: accepted, dismissed, marked as a false alarm, or marked &ldquo;rule is unclear&rdquo;.
          Each rule gets a clarity score once it has {MIN_DECISIONS} or more decisions. Unclear rules get a suggested clearer wording, built from real cases, for the brand admin to approve.
        </p>
      </div>
      <RuleHealthList
        flagged={flagged}
        healthy={items.filter((i) => i.status === "clear")}
        noData={items.filter((i) => i.status === "no_data").length}
        alarms={alarms.map((a) => ({ ...a, title: title(a.rule_id) }))}
        isAdmin={me.role === "admin"}
      />
    </div>
  );
}
