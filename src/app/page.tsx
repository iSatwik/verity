import Link from "next/link";
import { USERS } from "@/lib/users";
import { currentUser, hasChosenRole } from "@/lib/session";
import { q } from "@/lib/db";
import { RoleCards } from "@/components/RoleCards";
import { Card } from "@/components/ui";

export default async function Home() {
  const me = await currentUser();
  const chosen = await hasChosenRole();
  const demo = await q<{ id: number; title: string }>("SELECT id, title FROM submissions WHERE title = 'Neem cleanser launch post' ORDER BY id LIMIT 1");
  const demoId = demo[0]?.id;
  return (
    <div className="space-y-8">
      <section className="grid gap-8 rounded-2xl bg-ink px-8 py-10 text-white md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300">Brand checks before you publish</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight">Catch it, explain it, fix it, approve it, <span className="text-emerald-300">before it goes live.</span></h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-gray-300">
            Paste a post, upload a document or add an image. Verity checks it against the brand&apos;s approved rules, facts, terminology and colours.
            Every issue shows the exact rule it breaks and a suggested fix, and a person makes the final approval.
          </p>
          <p className="mt-3 max-w-xl text-sm text-gray-400">
            This demo uses <b className="text-gray-200">Aranya Naturals</b>, a fictional skincare brand. There&apos;s no sign-in: pick a role below and click around.
          </p>
        </div>
        <Card className="border-white/10 bg-white/5 p-5 text-sm text-gray-200">
          <p className="mb-3 font-semibold text-white">Try the full flow in 2 minutes</p>
          <ol className="list-decimal space-y-2 pl-5 text-gray-300">
            <li>Be <b className="text-white">Rahul (creator)</b>. Open <i>Neem cleanser launch post</i> and see each issue with its rule.</li>
            <li>Click <b className="text-white">Accept all fixes</b>, add the alt text, then <b className="text-white">Run check again</b>.</li>
            <li><b className="text-white">Submit for review</b>. Posts with claims go to the brand manager <i>and</i> compliance.</li>
            <li>Switch to <b className="text-white">Ritika</b>, then <b className="text-white">Arjun</b>, and approve. The version gets locked with a review record.</li>
            <li>Or start from scratch: <b className="text-white">New submission → load a sample</b>.</li>
          </ol>
          {demoId && (
            <Link href={`/submissions/${demoId}`} className="mt-4 inline-flex h-9 items-center rounded-lg bg-emerald-400 px-4 font-semibold text-ink hover:bg-emerald-300">
              Open the demo post →
            </Link>
          )}
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold">Choose who you are</h2>
            <p className="text-sm text-gray-500">{chosen ? <>You are currently <b>{me.name}</b> ({me.roleLabel}). You can switch any time from the top right.</> : "You can switch any time from the top right."}</p>
          </div>
        </div>
        <RoleCards users={USERS} currentId={chosen ? me.id : null} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["No source, no block", "A finding can only block a post if it cites a real rule or approved fact. AI suggestions that can't be verified show up as grey advisory notes and never block."],
          ["Code first, AI second", "Banned words, product names, prices, dates, colours, contrast and alt text are checked by plain code. AI is only used for tone and wording, and only after private data is masked."],
          ["Humans decide", "Nothing is changed automatically. Creators accept or dismiss each fix with a reason; risky posts also go to compliance; every decision is in the audit log."],
        ].map(([t, d]) => (
          <Card key={t} className="p-5">
            <p className="font-semibold">{t}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{d}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
