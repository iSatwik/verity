"use client";

import { useTransition } from "react";
import { chooseRole } from "@/app/actions";
import type { DemoUser } from "@/lib/users";

export function RoleCards({ users, currentId }: { users: DemoUser[]; currentId: string | null }) {
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {users.map((u) => (
        <button
          key={u.id}
          disabled={pending}
          onClick={() => start(() => chooseRole(u.id))}
          className={`group rounded-xl border bg-white p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 ${currentId === u.id ? "border-brand-500 ring-2 ring-brand-100" : "border-gray-200"}`}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ background: u.color }}>{u.initials}</span>
            <div>
              <p className="font-semibold">{u.name}</p>
              <p className="text-xs text-gray-500">{u.roleLabel} · {u.team}</p>
            </div>
          </div>
          <ul className="mt-4 space-y-1.5 text-sm text-gray-600">
            {u.canDo.map((c) => <li key={c} className="flex gap-2"><span className="text-brand-500">✓</span>{c}</li>)}
          </ul>
          <p className="mt-4 text-sm font-semibold text-brand-600 group-hover:underline">{currentId === u.id ? "Continue as " : "Continue as "}{u.name.split(" ")[0]} →</p>
        </button>
      ))}
    </div>
  );
}
