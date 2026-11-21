import { dbMode } from "@/lib/db";
import { aiProvider, companyAiHost } from "@/lib/check/ai";
import { demoSignInEnabled } from "@/lib/users";
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
        <p><b>3. AI second, and verified.</b> With an AI key, the masked text is also reviewed for tone, messaging and claims, and the AI writes the intent card. The AI must cite a rule or fact ID and quote it. Code then verifies that the ID exists, the quote really appears in that rule, and the quoted words really appear in the post. Anything that fails becomes a grey <i>advisory</i> that can never block.</p>
        <p><b>4. Humans decide.</b> Creators accept, edit or dismiss each fix (with a reason). Blockers can only be dismissed as an exception request. Content with claims, offers or disclosures goes to the brand manager <i>and</i> compliance. Approval locks the version with a SHA-256 hash, the brand rules version and the approvers.</p>
        <p><b>5. Images.</b> Words in an image are read on our own server (OCR, no AI). Contrast is measured on each line of text, and the logo is checked for stretching, wrong colours, size and clear space. Private words found in an image (prices not yet announced, codenames, emails, phone numbers) are blurred before the image is sent to any AI.</p>
        <p><b>6. Rule health.</b> Every accept, dismiss and &ldquo;rule is unclear&rdquo; is counted per rule. Rules people keep pushing back on get a clarity score and a suggested clearer wording that the admin can review and apply. Wording marked as a false alarm is remembered, so the same wrong warning does not come back (must-fix issues are never hidden).</p>
        <p><b>7. Accounts and privacy.</b> Everyone signs in with their own account (passwords stored as scrypt hashes, signed session cookie). What each role can read and change is enforced by the database itself (row-level security), not just hidden in the page. A company can point Verity at its own AI server, so content never leaves the company.</p>
      </Card>
      <Card className="p-5 text-sm">
        <p className="mb-2 font-semibold">This deployment</p>
        <ul className="space-y-1 text-gray-700">
          <li>Database: <b>{dbMode() === "supabase" ? "Supabase Postgres" : "Local Postgres (PGlite)"}</b></li>
          <li>AI checks: <b>{ai === "company" ? `On, using the company's own AI server (${companyAiHost()}). Nothing goes to an outside AI service.` : ai === "gemini" ? "On, using a hosted AI service (text is masked and private words in images are blurred first)" : ai === "mock" ? "Test mode" : "Off: code checks only"}</b></li>
          <li>Sign-in: <b>email and password{demoSignInEnabled() ? ", plus one-click demo sign-in for the four sample people" : ""}</b></li>
          <li>Access limits: <b>enforced in the database (row-level security)</b></li>
        </ul>
      </Card>
      <Card className="p-5 text-sm">
        <p className="mb-1 font-semibold">Disclosures</p>
        <ul className="list-disc space-y-1 pl-5 text-gray-700">
          <li>Aranya Naturals, its products, prices, studies and people are fictional, made up for this demo.</li>
          <li>Built with help from an AI coding assistant (Claude); details are in the repository README.</li>
          <li>Open-source libraries: Next.js, React, Tailwind CSS, PGlite, postgres.js, sharp, culori, tesseract.js, mammoth, unpdf, jsdiff.</li>
        </ul>
      </Card>
      <Card className="flex items-center justify-between p-5 text-sm">
        <div><p className="font-semibold">Reset the demo</p><p className="text-gray-500">Puts back the original sample brand and submissions. Clears everything else.</p></div>
        <ActionButton variant="danger" confirm="Reset all demo data? This removes every submission and Canon change." action={resetDemoAction}>Reset demo data</ActionButton>
      </Card>
    </div>
  );
}
