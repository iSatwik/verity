"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { chooseRole } from "@/app/actions";
import type { DemoUser } from "@/lib/users";
import { Avatar } from "./ui";
import { BrandLogo } from "./BrandLogo";

/** First screen on a visit: pick who you are before anything else loads. */
export function RoleGate({ users }: { users: DemoUser[] }) {
  const path = usePathname();
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <div className="mx-auto max-w-3xl py-6">
      <p className="flex items-center gap-2 text-[13px] text-gray-500"><BrandLogo size={22} />Aranya Naturals · reviewed with Verity</p>
      <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-gray-900">Who are you?</h1>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-gray-600">
        This is a demo for <b className="font-medium text-gray-800">Aranya Naturals</b>, a made-up skincare brand. Pick a person to use Verity as them.
        There is no sign-in, and you can switch person anytime from the top right.
      </p>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {users.map((u, i) => (
          <button
            key={u.id}
            disabled={busy !== null}
            onClick={async () => { setBusy(u.id); await chooseRole(u.id, path); }}
            className="group relative flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left hover:border-brand-500 hover:bg-brand-50/40 disabled:opacity-70"
          >
            <Avatar initials={u.initials} color={u.color} size={40} />
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-gray-900">{u.name}</span>
              <span className="block text-[13px] text-gray-500">{u.roleLabel}</span>
              <span className="mt-1.5 block text-[13px] leading-snug text-gray-700">{u.oneLine}</span>
            </span>
            {i === 0 && <span className="absolute right-3 top-3 rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">Start here</span>}
            {busy === u.id && <span className="absolute bottom-3 right-3 h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />}
          </button>
        ))}
      </div>
      <p className="mt-6 text-[13px] text-gray-500">
        New here? Start as <b className="font-medium text-gray-700">Rahul</b>: open a post, fix its issues and send it for approval. Then switch to the reviewers to approve it.
      </p>
    </div>
  );
}
