import { SAMPLES } from "@/lib/seed-data";
import { NewSubmissionForm } from "@/components/NewSubmissionForm";
import { currentUser } from "@/lib/session";

export const maxDuration = 60;

export default async function NewSubmission() {
  const me = await currentUser();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New submission</h1>
        <p className="text-sm text-gray-500">Paste a caption, email or ad, upload a Word/PDF document, and/or attach an image. Verity checks it against the Aranya Naturals brand rules in a few seconds.</p>
      </div>
      {me.role !== "creator" && me.role !== "admin" && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">You&apos;re signed in as {me.name} ({me.roleLabel}). Anyone can try a check, but in a real team creators submit and you review.</p>
      )}
      <NewSubmissionForm samples={SAMPLES.map((s) => ({ key: s.key, title: s.title, channel: s.channel, text: s.text, image: s.image ?? null, imageText: s.imageText ?? "", imageAlt: s.imageAlt ?? "", hint: s.hint }))} />
    </div>
  );
}
