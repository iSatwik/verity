import { STATUS_LABEL, CHANNELS } from "@/lib/labels";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-gray-200 bg-white ${className}`}>{children}</div>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{children}</div>;
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
  draft: "bg-gray-100 text-gray-700",
  needs_fixes: "bg-red-50 text-red-700",
  ready: "bg-blue-50 text-blue-700",
  in_review: "bg-amber-50 text-amber-800",
  changes_requested: "bg-orange-50 text-orange-700",
  approved: "bg-brand-50 text-brand-700",
};
export function StatusPill({ status }: { status: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ST[status] ?? ST.draft}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function ChannelTag({ channel }: { channel: string }) {
  return <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{CHANNELS[channel] ?? channel}</span>;
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
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
