import Link from "next/link";
import { q } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { getUser } from "@/lib/users";
import { Card, ChannelTag, StatusPill, timeAgo } from "@/components/ui";

interface Row { id: number; title: string; channel: string; author_id: string; status: string; risk_tier: string; current_version: number; updated_at: string; exceptions: number; manager_ok: boolean; compliance_ok: boolean }

export default async function ReviewQueue() {
  const me = await currentUser();
  const rows = await q<Row>(`
    SELECT s.id, s.title, s.channel, s.author_id, s.status, s.risk_tier, s.current_version, s.updated_at,
      (SELECT COUNT(*) FROM findings f WHERE f.submission_id = s.id AND f.version_n = s.current_version AND f.status = 'exception_requested')::int AS exceptions,
      EXISTS (SELECT 1 FROM approvals a WHERE a.submission_id = s.id AND a.version_n = s.current_version AND a.role = 'manager' AND a.decision <> 'changes_requested') AS manager_ok,
      EXISTS (SELECT 1 FROM approvals a WHERE a.submission_id = s.id AND a.version_n = s.current_version AND a.role = 'compliance' AND a.decision <> 'changes_requested') AS compliance_ok
    FROM submissions s WHERE s.status IN ('in_review','approved','changes_requested') ORDER BY s.updated_at DESC`);
  const role = me.role === "admin" ? "manager" : me.role;
  const waiting = rows.filter((r) => r.status === "in_review" && ((role === "manager" && !r.manager_ok) || (role === "compliance" && r.risk_tier === "claims" && !r.compliance_ok)));
  const others = rows.filter((r) => !waiting.includes(r));
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Review queue</h1>
        <p className="text-sm text-gray-500">
          {me.role === "creator" ? "Creators don't review. Switch to Ritika (brand manager) or Arjun (compliance) at the top right to approve content." :
            me.role === "compliance" ? "You only see content with claims, offers or disclosures. Everything else only needs the brand manager." :
            "Content waiting for your approval. Each item has already passed the automatic checks."}
        </p>
      </div>
      <Card>
        <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold">Waiting for you ({waiting.length})</div>
        {waiting.length === 0 && <p className="px-4 py-6 text-sm text-gray-500">Nothing waiting for {me.name} right now.</p>}
        {waiting.map((r) => <QueueRow key={r.id} r={r} />)}
      </Card>
      <Card>
        <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-600">Other reviews</div>
        {others.map((r) => <QueueRow key={r.id} r={r} />)}
        {others.length === 0 && <p className="px-4 py-6 text-sm text-gray-500">None.</p>}
      </Card>
    </div>
  );
}

function QueueRow({ r }: { r: Row }) {
  const a = getUser(r.author_id);
  return (
    <Link href={`/submissions/${r.id}`} className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-4 py-3 text-sm first:border-t-0 hover:bg-gray-50">
      <span className="font-medium">{r.title}</span>
      <ChannelTag channel={r.channel} />
      <StatusPill status={r.status} />
      {r.exceptions > 0 && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">{r.exceptions} exception request{r.exceptions > 1 ? "s" : ""}</span>}
      <span className="text-xs text-gray-500">Route: Manager {r.manager_ok ? "✓" : "…"}{r.risk_tier === "claims" ? ` · Compliance ${r.compliance_ok ? "✓" : "…"}` : ""}</span>
      <span className="ml-auto text-xs text-gray-500">by {a.name} · v{r.current_version} · {timeAgo(r.updated_at)}</span>
    </Link>
  );
}
