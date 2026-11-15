import { STATUS_LABEL, CHANNELS } from "@/lib/labels";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-gray-200 bg-white ${className}`}>{children}</div>;
}

export const SEVERITY_LABEL: Record<string, string> = { blocker: "Must fix", major: "Should fix", minor: "Nice to fix", advisory: "Suggestions" };

export function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[12px] font-medium text-gray-500">{children}</div>;
}

const SEV: Record<string, string> = {
  blocker: "bg-red-50 text-red-700 ring-red-200",
  major: "bg-amber-50 text-amber-800 ring-amber-200",
  minor: "bg-blue-50 text-blue-700 ring-blue-200",
  advisory: "bg-gray-100 text-gray-600 ring-gray-200",
};
export function SeverityBadge({ severity }: { severity: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ${SEV[severity] ?? SEV.advisory}`}>{severity}</span>;
}

const ST: Record<string, string> = {
  draft: "bg-gray-400",
  needs_fixes: "bg-red-500",
  ready: "bg-sky-500",
  in_review: "bg-amber-400",
  changes_requested: "bg-orange-500",
  approved: "bg-brand-500",
};
export function StatusPill({ status }: { status: string }) {
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-gray-700"><span className={`h-2 w-2 rounded-full ${ST[status] ?? ST.draft}`} />{STATUS_LABEL[status] ?? status}</span>;
}

export function ChannelTag({ channel }: { channel: string }) {
  return <span className="text-[13px] text-gray-600">{CHANNELS[channel] ?? channel}</span>;
}

export function Avatar({ initials, color, size = 28 }: { initials: string; color: string; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ background: color, width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}

export function TimeAgo({ date }: { date: string | Date }) {
  return <span suppressHydrationWarning>{timeAgo(date)}</span>;
}

export function timeAgo(d: string | Date): string {
  const t = new Date(d).getTime();
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

export function IssueCounts({ b, m, o }: { b: number; m: number; o: number }) {
  if (b + m + o === 0) return <span className="text-[13px] text-gray-500">No issues</span>;
  const parts: React.ReactNode[] = [];
  if (b) parts.push(<span key="b" className="text-red-700">{b} must fix</span>);
  if (m) parts.push(<span key="m" className="text-amber-700">{m} should fix</span>);
  if (o) parts.push(<span key="o" className="text-gray-500">{o} minor</span>);
  return <span className="text-[13px]">{parts.flatMap((p, i) => (i ? [<span key={`s${i}`} className="text-gray-300"> · </span>, p] : [p]))}</span>;
}
