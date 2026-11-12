import Link from "next/link";
import { q } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { getUser } from "@/lib/users";
import { Card, ChannelTag, StatusPill, Avatar, timeAgo, IssueCounts } from "@/components/ui";

interface Row { id: number; title: string; channel: string; author_id: string; status: string; risk_tier: string; current_version: number; updated_at: string; blockers: number; majors: number; others: number; has_image: boolean }

export default async function Submissions() {
  const me = await currentUser();
  const rows = await q<Row>(`
    SELECT s.id, s.title, s.channel, s.author_id, s.status, s.risk_tier, s.current_version, s.updated_at, (s.image_data IS NOT NULL) AS has_image,
      COALESCE(SUM(CASE WHEN f.severity='blocker' AND f.status IN ('open','exception_requested') THEN 1 ELSE 0 END),0)::int AS blockers,
      COALESCE(SUM(CASE WHEN f.severity='major' AND f.status='open' THEN 1 ELSE 0 END),0)::int AS majors,
      COALESCE(SUM(CASE WHEN f.severity IN ('minor','advisory') AND f.status='open' THEN 1 ELSE 0 END),0)::int AS others
    FROM submissions s LEFT JOIN findings f ON f.submission_id = s.id AND f.version_n = s.current_version
    GROUP BY s.id ORDER BY s.updated_at DESC`);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Submissions</h1>
          <p className="text-sm text-gray-500">Everything going out for Aranya Naturals: posts, ads, emails and documents. {me.role === "creator" ? "Start a new one, or open one to fix its issues." : "Open any submission to see its checks and history."}</p>
        </div>
        <Link href="/submissions/new" className="inline-flex h-9 items-center rounded-md bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600">New submission</Link>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 text-left text-[12px] font-medium text-gray-500">
            <tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Channel</th><th className="px-4 py-3">Open issues</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Approval route</th><th className="px-4 py-3">Author</th><th className="px-4 py-3">Updated</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const a = getUser(r.author_id);
              return (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3"><Link href={`/submissions/${r.id}`} className="font-medium text-gray-900 hover:underline">{r.title}</Link><span className="ml-2 text-xs text-gray-400">#{r.id} · v{r.current_version}{r.has_image ? " · 🖼 image" : ""}</span></td>
                  <td className="px-4 py-3"><ChannelTag channel={r.channel} /></td>
                  <td className="px-4 py-3">
                    {r.status === "approved" ? <span className="text-gray-400">—</span> : <IssueCounts b={r.blockers} m={r.majors} o={r.others} />}
                  </td>
                  <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-600">{r.risk_tier === "claims" ? "Manager + Compliance" : "Manager"}</td>
                  <td className="px-4 py-3"><span className="flex items-center gap-2"><Avatar initials={a.initials} color={a.color} size={22} /><span className="text-xs text-gray-600">{a.name}</span></span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{timeAgo(r.updated_at)}</td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">No submissions yet. <Link className="underline" href="/submissions/new">Create the first one</Link>.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
