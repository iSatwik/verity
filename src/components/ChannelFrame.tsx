import { BrandLogo } from "./BrandLogo";

/**
 * A light, channel-specific frame around the content, so an email reads like an email,
 * an ad shows "Sponsored", a press release looks like a document, and so on.
 * Purely visual: the text inside is unchanged.
 */
export function ChannelFrame({ channel, title, children }: { channel: string; title: string; children: React.ReactNode }) {
  const bar = "mb-3 flex items-center gap-2 border-b border-gray-100 pb-2.5 text-[12px] text-gray-500";
  const brandDot = <span className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white"><BrandLogo size={20} /></span>;

  switch (channel) {
    case "instagram":
      return (
        <div>
          <div className={bar}>{brandDot}<span className="font-semibold text-gray-800">aranyanaturals</span><span>· Instagram caption</span></div>
          {children}
        </div>
      );
    case "influencer":
      return (
        <div>
          <div className={bar}><span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-600">@</span><span className="font-semibold text-gray-800">creator</span><span>· post for Aranya Naturals</span></div>
          {children}
        </div>
      );
    case "ad":
      return (
        <div>
          <div className={bar}>{brandDot}<span className="font-semibold text-gray-800">Aranya Naturals</span><span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">Sponsored</span></div>
          {children}
        </div>
      );
    case "email":
      return (
        <div>
          <div className="mb-3 space-y-0.5 border-b border-gray-100 pb-2.5 text-[12px] text-gray-500">
            <div className="flex items-center"><span className="inline-block w-14 text-gray-400">From</span><BrandLogo size={16} className="mr-1.5" />Aranya Naturals</div>
            <div><span className="inline-block w-14 text-gray-400">Subject</span><span className="font-medium text-gray-800">{title}</span></div>
          </div>
          {children}
        </div>
      );
    case "website":
      return (
        <div>
          <div className="mb-3 flex items-center gap-2 rounded-md bg-gray-50 px-2.5 py-1.5 text-[12px] text-gray-400">
            <span className="flex gap-1"><span className="h-2 w-2 rounded-full bg-gray-300" /><span className="h-2 w-2 rounded-full bg-gray-300" /><span className="h-2 w-2 rounded-full bg-gray-300" /></span>
            <BrandLogo size={14} /><span>aranya-naturals.example / product page</span>
          </div>
          {children}
        </div>
      );
    case "press":
      return (
        <div className="font-serif">
          <div className="mb-3 flex items-center gap-2 border-b border-gray-100 pb-2.5 font-sans text-[11px] font-semibold uppercase tracking-wider text-gray-500"><BrandLogo size={20} />Press release · Aranya Naturals</div>
          {children}
        </div>
      );
    case "document":
      return (
        <div className="border-l-2 border-gray-100 pl-4 font-serif">
          <div className="mb-3 flex items-center gap-2 font-sans text-[12px] text-gray-500"><BrandLogo size={18} />Document · {title}</div>
          {children}
        </div>
      );
    default:
      return <>{children}</>;
  }
}
