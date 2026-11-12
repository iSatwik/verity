import Link from "next/link";
import { q } from "@/lib/db";
import { loadCanonWith, factState } from "@/lib/canon";
import { Card, Label } from "@/components/ui";

export default async function Insights() {
  const [totals, bySource, byCat, byChannel, decisions, unclear, canon] = await Promise.all([
    q<{ subs: number; checks: number; blockers: number; fixed: number; approved: number; in_review: number }>(`SELECT
      (SELECT COUNT(*) FROM submissions)::int AS subs,
      (SELECT COUNT(*) FROM checks)::int AS checks,
      (SELECT COUNT(*) FROM findings f JOIN submissions s ON s.id = f.submission_id WHERE f.severity = 'blocker' AND f.version_n = 1)::int AS blockers,
      (SELECT COUNT(*) FROM findings WHERE status IN ('accepted','resolved'))::int AS fixed,
      (SELECT COUNT(*) FROM submissions WHERE status = 'approved')::int AS approved,
      (SELECT COUNT(*) FROM submissions WHERE status = 'in_review')::int AS in_review`),
    q<{ id: string; n: number }>(`SELECT sources->0->>'id' AS id, COUNT(*)::int AS n FROM findings WHERE version_n = 1 AND jsonb_array_length(sources) > 0 GROUP BY 1 ORDER BY 2 DESC LIMIT 8`),
    q<{ category: string; n: number }>(`SELECT category, COUNT(*)::int AS n FROM findings WHERE version_n = 1 GROUP BY 1 ORDER BY 2 DESC`),
    q<{ channel: string; n: number }>(`SELECT s.channel, COUNT(*)::int AS n FROM findings f JOIN submissions s ON s.id = f.submission_id WHERE f.version_n = 1 GROUP BY 1 ORDER BY 2 DESC`),
    q<{ reason: string; n: number }>(`SELECT split_part(decision_reason, ':', 1) AS reason, COUNT(*)::int AS n FROM findings WHERE status IN ('dismissed','exception_requested') AND decision_reason NOT LIKE '%carried over%' GROUP BY 1 ORDER BY 2 DESC`),
    q<{ id: string; n: number }>(`SELECT sources->0->>'id' AS id, COUNT(*)::int AS n FROM findings WHERE status IN ('dismissed','exception_requested') AND decision_reason LIKE 'Rule is unclear%' GROUP BY 1 ORDER BY 2 DESC`),
    loadCanonWith(q),
  ]);
  const t = totals[0];
  const max = Math.max(1, ...bySource.map((x) => x.n));
  const ruleText = (id: string) => canon.rules.find((r) => r.id === id)?.title ?? canon.terms.find((x) => x.id === id)?.note?.slice(0, 50) ?? canon.facts.find((f) => f.id === id)?.statement.slice(0, 50) ?? "";
  const facts = canon.facts.map((f) => ({ ...f, state: factState(f) })).filter((f) => f.state !== "active");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
        <p className="text-sm text-gray-500">What keeps going wrong, which rules confuse people, and which facts need updating. Live numbers from this demo workspace.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Submissions", t.subs, "posts, emails, docs"],
          ["Checks run", t.checks, "including re-checks"],
          ["Blockers caught", t.blockers, "on first check, before review"],
          ["Issues fixed", t.fixed, "accepted fixes"],
          ["Approved", t.approved, `${t.in_review} waiting in review`],
        ].map(([l, n, d]) => (
          <Card key={l as string} className="p-4"><Label>{l}</Label><p className="text-3xl font-bold">{n}</p><p className="text-xs text-gray-500">{d}</p></Card>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <Label>Most broken rules (first drafts)</Label>
          <div className="space-y-2.5">
            {bySource.map((r) => (
              <div key={r.id} className="grid grid-cols-[64px_1fr_28px] items-center gap-3 text-sm">
                <span className="rounded bg-brand-50 px-1.5 py-0.5 text-center font-mono text-xs font-semibold text-brand-700">{r.id}</span>
                <div>
                  <div className="text-xs text-gray-600">{ruleText(r.id)}</div>
                  <div className="mt-1 h-2.5 rounded bg-gray-100"><div className="h-2.5 rounded bg-brand-500" style={{ width: `${(r.n / max) * 100}%` }} /></div>
                </div>
                <span className="text-right font-semibold">{r.n}</span>
              </div>
            ))}
            {!bySource.length && <p className="text-sm text-gray-500">No data yet.</p>}
          </div>
        </Card>
        <Card className="p-5">
          <Label>Guideline Health: rules people find unclear</Label>
          {unclear.length ? (
            <ul className="space-y-2 text-sm">
              {unclear.map((u) => <li key={u.id} className="flex items-center gap-2"><span className="rounded bg-orange-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-orange-700">{u.id}</span>{ruleText(u.id)}<span className="ml-auto text-xs text-gray-500">dismissed as “unclear” {u.n}×</span></li>)}
            </ul>
          ) : <p className="text-sm text-gray-500">No rule has been dismissed as “Rule is unclear” yet. When creators do, the rule shows up here so the brand admin can rewrite it. (Ranking and drafted rewrites are planned for Round 3.)</p>}
          <div className="mt-4">
            <Label>Why findings get dismissed</Label>
            <div className="flex flex-wrap gap-2 text-xs">{decisions.length ? decisions.map((d) => <span key={d.reason} className="rounded-full bg-gray-100 px-2.5 py-1">{d.reason} · {d.n}</span>) : <span className="text-gray-500">No dismissals yet.</span>}</div>
          </div>
        </Card>
        <Card className="p-5">
          <Label>Issues by type</Label>
          <div className="flex flex-wrap gap-2 text-sm">{byCat.map((c) => <span key={c.category} className="rounded-lg border border-gray-200 px-3 py-1.5 capitalize">{c.category} <b className="ml-1">{c.n}</b></span>)}</div>
          <div className="mt-4"><Label>Issues by channel</Label>
            <div className="flex flex-wrap gap-2 text-sm">{byChannel.map((c) => <span key={c.channel} className="rounded-lg border border-gray-200 px-3 py-1.5">{c.channel} <b className="ml-1">{c.n}</b></span>)}</div>
          </div>
        </Card>
        <Card className="p-5">
          <Label>Facts that need attention</Label>
          {facts.length ? (
            <ul className="space-y-2 text-sm">{facts.map((f) => <li key={f.id} className="flex gap-2"><span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">{f.id}</span><span className="flex-1">{f.statement}</span><span className="whitespace-nowrap text-xs font-semibold capitalize text-amber-800">{f.state}{f.valid_until ? ` · ${f.valid_until}` : ""}</span></li>)}</ul>
          ) : <p className="text-sm text-gray-500">All facts are current.</p>}
          <Link href="/canon?tab=facts" className="mt-3 inline-block text-xs font-medium text-brand-600 hover:underline">Open approved facts →</Link>
        </Card>
      </div>
    </div>
  );
}
