import { dbMode } from "@/lib/db";
import { aiProvider } from "@/lib/check/ai";
import { Card } from "@/components/ui";
import { ActionButton } from "@/components/ActionButton";
import { resetDemoAction } from "@/app/actions";

export default function About() {
  const ai = aiProvider();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">How Verity works</h1>
        <p className="text-sm text-gray-500">Built by Team Knox (Tadoori Satwik) for CodeNova India 2026, problem statement by Inkloom AI.</p>
      </div>
      <Card className="space-y-3 p-5 text-sm leading-relaxed">
        <p><b>1. The brand rules.</b> The brand&apos;s rules, approved facts (each with a source, owner and expiry date), terminology, colours and confidential terms are stored as numbered items like <code>V-02</code> or <code>F-12</code>.</p>
        <p><b>2. Code checks first.</b> Banned and wrong words, product names, prices against the current price list, offers and dates, numbers like ingredient percentages, superlatives, comparisons, disclosure, tone markers (all caps, “!!”, emojis), link text, hashtags, image colours, text contrast and alt text are all checked by plain code. These checks are fast, repeatable and private.</p>
        <p><b>3. AI second, and verified.</b> With a Gemini API key, the masked text is also reviewed for tone, messaging and claims, and the AI writes the intent card. The AI must cite a rule or fact ID and quote it. Code then verifies that the ID exists, the quote really appears in that rule, and the quoted words really appear in the post. Anything that fails becomes a grey <i>advisory</i> that can never block.</p>
        <p><b>4. Humans decide.</b> Creators accept, edit or dismiss each fix (with a reason). Blockers can only be dismissed as an exception request. Content with claims, offers or disclosures goes to the brand manager <i>and</i> compliance. Approval locks the version with a SHA-256 hash, the brand rules version and the approvers.</p>
        <p><b>5. Learning.</b> Insights show the most broken rules and the rules that people mark as unclear.</p>
      </Card>
      <Card className="p-5 text-sm">
        <p className="mb-2 font-semibold">This deployment</p>
        <ul className="space-y-1 text-gray-700">
          <li>Database: <b>{dbMode() === "supabase" ? "Supabase Postgres" : "Local Postgres (PGlite)"}</b></li>
          <li>AI checks: <b>{ai === "gemini" ? "Google Gemini (on)" : ai === "mock" ? "Mock AI (testing)" : "Off: code checks only"}</b></li>
          <li>Sign-in: demo mode with a role switcher, so judges can try every role without an account</li>
        </ul>
      </Card>
      <Card className="p-5 text-sm">
        <p className="mb-1 font-semibold">Disclosures</p>
        <ul className="list-disc space-y-1 pl-5 text-gray-700">
          <li>Aranya Naturals, its products, prices, studies and people are fictional, made up for this demo.</li>
          <li>Built with help from an AI coding assistant (Claude); details are in the repository README.</li>
          <li>Open-source libraries: Next.js, React, Tailwind CSS, PGlite, postgres.js, sharp, culori, mammoth, unpdf, jsdiff.</li>
        </ul>
      </Card>
      <Card className="flex items-center justify-between p-5 text-sm">
        <div><p className="font-semibold">Reset the demo</p><p className="text-gray-500">Puts back the original sample brand and submissions. Clears everything else.</p></div>
        <ActionButton variant="danger" confirm="Reset all demo data? This removes every submission and Canon change." action={resetDemoAction}>Reset demo data</ActionButton>
      </Card>
    </div>
  );
}
