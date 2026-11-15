"use client";
import { BrandLogo } from "./BrandLogo";

import { useTransition } from "react";
import Link from "next/link";
import { chooseRole } from "@/app/actions";
import type { DemoUser } from "@/lib/users";

export function Landing({ users, currentId, demoId }: { users: DemoUser[]; currentId: string | null; demoId?: number }) {
  const [pending, start] = useTransition();
  return (
    <div className="mx-auto max-w-3xl space-y-10 py-4">
      <div>
        <p className="flex items-center gap-2 text-[13px] text-gray-500"><BrandLogo size={22} />Aranya Naturals · demo workspace</p>
        <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-gray-900">Brand review before publishing</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-gray-600">
          Verity checks posts, ads, emails, documents and images against the brand&apos;s approved rules, facts, words and colours.
          Each issue points to the rule it breaks and comes with a suggested fix. Nothing is published until a person approves it.
        </p>
        <p className="mt-2 text-[13px] text-gray-500">Aranya Naturals is a made-up skincare brand for this demo. There&apos;s no sign-in: pick a person below.</p>
      </div>

      <div>
        <h2 className="mb-3 text-[13px] font-semibold text-gray-900">Continue as</h2>
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {users.map((u) => (
            <button key={u.id} disabled={pending} onClick={() => start(() => chooseRole(u.id))} className="flex w-full items-center gap-4 px-4 py-3.5 text-left hover:bg-gray-50 disabled:opacity-60">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white" style={{ background: u.color }}>{u.initials}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-gray-900">{u.name} <span className="font-normal text-gray-500">· {u.roleLabel}</span>{currentId === u.id && <span className="ml-2 text-[12px] text-brand-700">current</span>}</span>
                <span className="block text-[13px] text-gray-500">{u.oneLine}</span>
              </span>
              <span className="text-gray-400">→</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-[13px] font-semibold text-gray-900">A quick way to try it</h2>
        <ol className="space-y-2 text-[14px] text-gray-700">
          <li><span className="mr-2 text-gray-400">1</span>Continue as <b>Rahul</b> and open {demoId ? <Link href={`/submissions/${demoId}`} className="text-brand-700 underline underline-offset-2">Neem cleanser launch post</Link> : "Neem cleanser launch post"}. Each underlined part is an issue.</li>
          <li><span className="mr-2 text-gray-400">2</span>Accept the suggestions, use <b>Edit → Use the designer&apos;s corrected image</b>, then <b>Run check</b>.</li>
          <li><span className="mr-2 text-gray-400">3</span><b>Submit for review</b>. Because it makes claims, both the brand manager and compliance must approve.</li>
          <li><span className="mr-2 text-gray-400">4</span>Switch to <b>Arjun</b>, then <b>Ritika</b> (top right) and approve. The version gets locked.</li>
          <li><span className="mr-2 text-gray-400">5</span>Or try your own text: <Link href="/submissions/new" className="text-brand-700 underline underline-offset-2">New submission</Link>.</li>
        </ol>
      </div>

      <div className="grid gap-6 border-t border-gray-200 pt-6 text-[13px] leading-relaxed text-gray-600 sm:grid-cols-3">
        <p><b className="text-gray-900">Every issue cites a rule.</b> If an AI suggestion can&apos;t point to a real rule or approved fact, it&apos;s only a suggestion and can&apos;t block anything.</p>
        <p><b className="text-gray-900">Exact checks are plain code.</b> Product names, prices, banned words, colours, contrast and alt text are checked without AI.</p>
        <p><b className="text-gray-900">People decide.</b> Nothing changes automatically, and every decision is kept in the audit log.</p>
      </div>
    </div>
  );
}
