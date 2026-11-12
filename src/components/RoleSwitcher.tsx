"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { chooseRole } from "@/app/actions";
import type { DemoUser } from "@/lib/users";

export function RoleSwitcher({ users, currentId, highlight }: { users: DemoUser[]; currentId: string; highlight?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const path = usePathname();
  const me = users.find((u) => u.id === currentId) ?? users[0];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm ${highlight ? "border-brand-500 ring-2 ring-brand-100" : "border-gray-200"} bg-white hover:bg-gray-50`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: me.color }}>{me.initials}</span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block font-medium">{me.name}</span>
          <span className="block text-[11px] text-gray-500">{me.roleLabel}</span>
        </span>
        <span className="ml-1 text-xs text-gray-400">{pending ? "…" : "Switch role ▾"}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          <p className="px-2 pb-2 pt-1 text-xs text-gray-500">Demo mode: no sign-in. Pick who you want to be.</p>
          {users.map((u) => (
            <button
              key={u.id}
              role="menuitem"
              disabled={pending}
              onClick={() => start(async () => { setOpen(false); await chooseRole(u.id, path === "/" ? undefined : path); })}
              className={`flex w-full items-start gap-3 rounded-lg p-2 text-left hover:bg-gray-50 ${u.id === me.id ? "bg-brand-50" : ""}`}
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ background: u.color }}>{u.initials}</span>
              <span className="text-sm">
                <span className="font-medium">{u.name}</span> <span className="text-gray-500">· {u.roleLabel}</span>
                <span className="block text-xs text-gray-500">{u.canDo[0]}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
