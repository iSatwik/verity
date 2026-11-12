"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/users";

export function NavLinks({ role }: { role: Role }) {
  const path = usePathname();
  const items = [
    { href: "/submissions", label: "Submissions" },
    { href: "/review", label: "Review queue" },
    { href: "/canon", label: "Brand Canon" },
    { href: "/insights", label: "Insights" },
    { href: "/audit", label: "Audit log" },
  ];
  return (
    <nav className="flex items-center gap-1 overflow-x-auto text-sm">
      {items.map((it) => {
        const on = path === it.href || path.startsWith(it.href + "/");
        const hint = (role === "creator" && it.href === "/submissions") || ((role === "manager" || role === "compliance") && it.href === "/review") || (role === "admin" && it.href === "/canon");
        return (
          <Link key={it.href} href={it.href} className={`whitespace-nowrap rounded-md px-3 py-1.5 ${on ? "bg-brand-50 font-semibold text-brand-700" : "text-gray-600 hover:bg-gray-100"}`}>
            {it.label}
            {hint && !on && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-brand-500 align-middle" aria-label="suggested for your role" />}
          </Link>
        );
      })}
    </nav>
  );
}
