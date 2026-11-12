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
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-gray-100 ${highlight ? "ring-1 ring-brand-500" : ""}`}>
        <span className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ background: me.color }}>{me.initials}</span>
        <span className="hidden text-left sm:block"><span className="text-gray-900">{me.name}</span> <span className="text-gray-500">· {me.roleLabel}</span></span>
        <span className="text-[10px] text-gray-400">{pending ? "…" : "▼"}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-1 w-72 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <p className="px-3 pb-1 pt-2 text-[12px] text-gray-500">Switch person (demo, no sign-in)</p>
          {users.map((u) => (
            <button key={u.id} role="menuitem" disabled={pending}
              onClick={() => start(async () => { setOpen(false); await chooseRole(u.id, path === "/" ? undefined : path); })}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] hover:bg-gray-50 ${u.id === me.id ? "bg-gray-50" : ""}`}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ background: u.color }}>{u.initials}</span>
              <span className="flex-1"><span className="text-gray-900">{u.name}</span> <span className="text-gray-500">· {u.roleLabel}</span></span>
              {u.id === me.id && <span className="text-brand-700">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
