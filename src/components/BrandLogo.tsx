import { ARANYA_LOGO } from "@/lib/brand-logo";

/** Logo of the demo brand (Aranya Naturals). */
export function BrandLogo({ size = 24, className = "" }: { size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={ARANYA_LOGO} alt="Aranya Naturals logo" width={size} height={size} className={`shrink-0 ${className}`} style={{ width: size, height: size }} />;
}

/** Small "workspace" chip for the header: which brand you are working on. */
export function BrandChip() {
  return (
    <span className="-ml-4 hidden items-center gap-1.5 border-l border-gray-200 pl-3 text-[13px] text-gray-600 sm:flex">
      <BrandLogo size={20} />Aranya Naturals
    </span>
  );
}
