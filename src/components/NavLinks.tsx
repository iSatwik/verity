"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/users";

export function NavLinks({ role }: { role: Role }) {
  const path = usePathname();
  const items = [
    { href: "/submissions", label: "Submissions" },
    { href: "/review", label: "Review" },
    { href: "/canon", label: "Brand rules" },
    { href: "/rule-health", label: "Rule health" },
    { href: "/insights", label: "Insights" },
    { href: "/audit", label: "Audit log" },
  ];
  void role;
  return (
    <nav className="flex items-center gap-5 overflow-x-auto text-[14px]">
      {items.map((it) => {
        const on = path === it.href || path.startsWith(it.href + "/");
        return (
          <Link key={it.href} href={it.href} className={`whitespace-nowrap py-4 ${on ? "border-b-2 border-gray-900 font-medium text-gray-900" : "border-b-2 border-transparent text-gray-500 hover:text-gray-900"}`}>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
