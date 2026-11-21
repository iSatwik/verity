"use client";

import { useActionState, useState } from "react";
import { usePathname } from "next/navigation";
import { chooseRole, signInAction } from "@/app/actions";
import type { DemoUser } from "@/lib/users";
import { Avatar } from "./ui";
import { BrandLogo } from "./BrandLogo";

/** Sign-in screen. Real email + password; demo people can also sign in with one click. */
export function RoleGate({ users, demo, demoPassword }: { users: DemoUser[]; demo: boolean; demoPassword: string }) {
  const path = usePathname();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(signInAction, null);
  const error = err ?? (state && !state.ok ? state.error : null);
  return (
    <div className="mx-auto grid max-w-4xl gap-10 py-6 md:grid-cols-[1fr_1.3fr]">
      <div>
        <p className="flex items-center gap-2 text-[13px] text-gray-500"><BrandLogo size={22} />Aranya Naturals · reviewed with Verity</p>
        <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-gray-900">Sign in</h1>
        <form action={formAction} className="mt-5 space-y-3">
          <input type="hidden" name="next" value={path} />
          <label className="block text-[13px] font-medium text-gray-700">Email
            <input name="email" type="email" autoComplete="username" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-[14px] focus:border-brand-500 focus:outline-none" placeholder="you@aranya.demo" />
          </label>
          <label className="block text-[13px] font-medium text-gray-700">Password
            <input name="password" type="password" autoComplete="current-password" required className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-[14px] focus:border-brand-500 focus:outline-none" />
          </label>
          {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
          <button disabled={pending || busy !== null} className="w-full rounded-md bg-brand-600 px-4 py-2 text-[14px] font-medium text-white hover:bg-brand-700 disabled:opacity-60">
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-[12px] leading-relaxed text-gray-500">
          Each person only sees what their role allows. The limits are enforced inside the database, not just hidden in the page.
        </p>
      </div>
      {demo && (
        <div>
          <p className="text-[15px] font-semibold text-gray-900">Or try the demo as one of these people</p>
          <p className="mt-1 text-[13px] text-gray-600">
            Aranya Naturals is a made-up skincare brand. Emails are shown on each card; the password is <code className="rounded bg-gray-100 px-1">{demoPassword}</code>.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {users.map((u, i) => (
              <button
                key={u.id}
                disabled={busy !== null || pending}
                onClick={async () => {
                  setBusy(u.id); setErr(null);
                  try { await chooseRole(u.id, path); } catch (e) { const m = (e as Error).message ?? ""; if (!m.includes("NEXT_REDIRECT")) { setErr(m); setBusy(null); } }
                }}
                className="group relative flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left hover:border-brand-500 hover:bg-brand-50/40 disabled:opacity-70"
              >
                <Avatar initials={u.initials} color={u.color} size={36} />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-2 text-[15px] font-semibold text-gray-900">{u.name}{i === 0 && <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700">Start here</span>}</span>
                  <span className="block text-[13px] text-gray-500">{u.roleLabel}</span>
                  <span className="block truncate text-[12px] text-gray-400">{u.email}</span>
                  <span className="mt-1.5 block text-[13px] leading-snug text-gray-700">{u.oneLine}</span>
                </span>
                {busy === u.id && <span className="absolute bottom-3 right-3 h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />}
              </button>
            ))}
          </div>
          <p className="mt-4 text-[13px] text-gray-500">
            New here? Start as <b className="font-medium text-gray-700">Rahul</b>: open a post, fix its issues and send it for approval. Then switch to the reviewers to approve it.
          </p>
        </div>
      )}
    </div>
  );
}
