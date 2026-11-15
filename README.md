# Verity: brand checks before you publish

**Team Knox · CodeNova India 2026 · Problem statement by Inkloom AI (brand governance)**

Verity checks content **before it is published** (an Instagram post, an ad, an email, a Word/PDF document or an image) against an organisation's approved **brand rules, facts, terminology and visual identity**. Every issue comes back with **the exact rule or fact it breaks** and **a suggested correction**, and **a human makes the final approval**.

> The demo uses **Aranya Naturals**, a *fictional* skincare brand. Its products, prices, studies and people are made up.

- **Live demo:** https://verity-swart-ten.vercel.app
- **Source:** https://github.com/iSatwik/verity
- **No sign-in needed.** Pick a role on the home page (or top right) and try the whole flow.

---

## Try it in 2 minutes (for judges)

1. Open the live link and choose **Rahul K. (Content creator)**.
2. Open **Neem cleanser launch post**. Every underlined part is an issue, grouped as **Must fix / Should fix / Nice to fix**, each linked to its rule (`C-1.2`, `F-12`, `T-02`…).
3. Click **Accept all … suggestions**, then **Edit → Use the designer's corrected image (demo) → Save**, then **Check again**.
4. **Submit for review.** The post has claims, so it goes to the brand manager **and** compliance.
5. Switch person (top right) to **Arjun V. (Compliance)** → **Approve**, then **Ritika S. (Brand manager)** → **Approve**. The version is locked with a SHA-256 review record.
6. Try your own content: **Submissions → New submission → load a sample**, or paste/upload anything.

## Features completed in Round 2

| Area | What works |
|---|---|
| **Brand Canon** | Rules (voice, messaging, claims, visual, accessibility, disclosure), approved facts with **source, owner, valid-from/valid-until and status**, terminology (brand name, product names, banned words, preferred words), colour palette, confidential terms. Admin can add, edit and delete; every change increases the Canon version and is logged. Import a brand guideline (.docx/.pdf/.txt) into draft rules. |
| **Content intake** | Paste text, upload **.docx / .pdf / .txt**, attach an **image** (PNG/JPG/WebP). Seven ready-made sample posts. Channel (Instagram, influencer, ad, email, website, press release, document). |
| **Checks (code)** | Wrong brand/product names · banned phrases (chemical-free, cure, fairness, clinically proven…) · **result claims vs approved facts, including the timeframe** (e.g. "3 days" vs approved "4 weeks") · superlatives (#1, best) · comparisons with other brands · numbers vs facts (ingredient %, SPF, founding year, offer %) · **prices vs the current price list (expired prices caught)** · delivery terms · claims relying on draft facts without proof · offer end date + T&C · paid-post disclosure (#ad) · confidential terms · tone (pushy phrases, "!!", emoji count, ALL CAPS) · Hinglish in formal channels · vague link text · CamelCase hashtags · long sentences. |
| **Visual identity** | Image colours checked **pixel by pixel** against the brand palette (CIEDE2000 ΔE), **estimated text contrast** (WCAG AA 4.5 : 1), **missing alt text** (with a suggested alt text), and the **text inside the image** is checked like the caption. |
| **AI (optional, verified)** | With a Gemini key: tone, messaging and claim review plus the intent card, and reading the text in images. The AI must cite a rule/fact ID **and quote it**; code verifies the ID exists, the quote is in that rule, and the quoted content is in the post. If not, the finding becomes a grey **advisory that can never block**. Private data (emails, phone numbers, PAN, Aadhaar-like numbers, card numbers, confidential terms) is **masked before** anything is sent. |
| **Explain & fix** | Findings are highlighted in the text, with severity (blocker / major / minor / advisory), the rule/fact text, and a suggested fix. **Accept**, **edit & accept**, **accept all**, or **dismiss with a reason**. Blockers can only become **exception requests** that a reviewer must approve. Decisions carry over to re-checks. |
| **Review & approval** | Risk-based routing: standard content → brand manager; claims/offers/disclosures → manager **and** compliance. Approve, request changes (note required), approve with exception (note required). Approval **locks** the version with a review record (SHA-256 hash, Canon version, approvers, time). Reopen for changes. |
| **Collaboration** | Comments, including comments on a selected line. Version history with word-level diffs. Activity timeline. |
| **Audit & AI log** | Every check, fix, dismissal, comment, approval and Canon change is logged. Every AI call is logged with the **masked** text that was sent. |
| **Insights** | Most broken rules, issues by type and channel, why findings get dismissed, rules marked "unclear", facts expired/expiring/without proof. |

## Accuracy and tests

`npm run eval`

| Test set | Recall / result | Precision / false alarms | Notes |
|---|---|---|---|
| Labelled set: 13 posts, 37 expected issues | 100% (37/37) | 100% (37/37) | Written together with the rules, so this score is optimistic. |
| Held-out set: 5 posts written after the rules were finished | 89% (8/9) | 100% (8/8) | The miss ("blocks 100% of UV rays") is a claim type with no code pattern. That's what the AI layer is for. Running this set also found one real bug ("part**ship**" matched "shipping"), which is now fixed. |
| Image checker (`npm run eval:images`): 20 generated ads with planted colour and contrast errors, plus clean ones | 90% (19/21 planted errors caught) | 2 false alarms in 19 clean checks | Misses: a red background read as a shade of the brand saffron, and orange-on-orange. False alarms come from the contrast *estimate*. |
| Confidential mode (`npm run eval:confidential`): 17 posts with canary confidential words, emails, phone, PAN, Aadhaar-like and card numbers | 0 canary leaks in the exact AI prompt | 18 values masked | This test found a real leak (quotes of already-found issues were sent unmasked); fixed. |

The real test is with people's own content; the 5-person user test moves to the start of Round 3 (see the PDF).

## How it works

```
Creator ──► New submission (text / .docx / .pdf / image)
              │
              ▼
   1. Code checks on text + text in the image       (rules.ts)
   2. Mask private data ──► Gemini review ──► citation verifier   (redact.ts, ai.ts)
   3. Image: palette ΔE, contrast, alt text          (image.ts)
   4. Intent card (AI or automatic)
              │
              ▼
   Findings (cite rule/fact IDs) ──► accept / edit / dismiss / exception
              │
              ▼
   Route by risk ──► Brand manager (+ Compliance) ──► Approved & locked (hash)
              │
              ▼
   Audit log · Insights · Brand Canon versions
```

## Tech stack

| Part | Choice | Why |
|---|---|---|
| App | **Next.js 16** (App Router, Server Actions), **TypeScript**, **Tailwind CSS 4** | One codebase for UI and server, easy to deploy on Vercel |
| Database | **Supabase Postgres** via `postgres` (postgres.js); **PGlite** (in-process Postgres) for local dev | Same SQL everywhere; runs locally with zero setup |
| AI | **Google Gemini** (REST, JSON output, temperature 0), model configurable | Text and image in one provider; free tier |
| Images | **sharp** (pixels), **culori** (CIEDE2000, WCAG contrast) | Visual checks without AI |
| Documents | **mammoth** (.docx), **unpdf** (.pdf) | Read uploaded documents |
| Diffs | **jsdiff** | Version history |
| Testing | `scripts/eval.ts`, `scripts/eval-heldout.ts`, Puppeteer end-to-end flows in `scripts/e2e/` | Accuracy numbers and full-flow tests |

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000. Uses a local PGlite database in ./.data, seeded automatically
npm run eval         # accuracy tests
npm run samples      # print findings for every sample post
```

## Deploy (Supabase + Gemini + Vercel)

1. **Supabase**: create a project (region: Mumbai). Click **Connect** → copy the **Transaction pooler** connection string (port **6543**) and put in your database password. This is `DATABASE_URL`. Tables and demo data are created automatically on first visit.
2. **Gemini** (optional): https://aistudio.google.com → **Get API key**. This is `GEMINI_API_KEY`.
3. **Vercel**: import this GitHub repo → **Environment Variables** → add `DATABASE_URL` (and `GEMINI_API_KEY`) → **Deploy**.
4. Open the link in an **incognito window** to check that it works without signing in.

> On Vercel, always set `DATABASE_URL`. Without it the app falls back to an in-memory database, and data would not be shared between requests.

## Changes from the Round 1 plan

- **Demo-mode role switcher instead of real sign-in.** The organisers require links that open without sign-in, so judges can switch between creator, manager, compliance and admin with one click. Real accounts come later.
- **Image checks moved into Round 2.** The Round 2 brief requires checks against visual identity, so the first version is already in (palette, contrast estimate, alt text, image text). Round 3 makes it precise.
- **Text inside images** is read by Gemini vision (or typed by the creator) instead of Tesseract OCR, and contrast is **estimated** from the image's main colours instead of measured per text box.
- **No vector search yet.** The Canon is small enough to send the relevant rules and facts in the AI prompt, and facts are matched by code (product, effect words, numbers). pgvector comes back when Canons grow.
- **Permissions are enforced in server code**, not yet with Postgres row-level security (planned with real accounts).
- **Simple highlighted editor** instead of TipTap.

## Three improvements for Round 3

1. **Precise image and accessibility checks.** Find each block of text in an image and measure its contrast exactly; detect the logo and its misuse (wrong colours, stretched, too small, no clear space); handle real product photos. Target: ≥95% of planted errors caught, ≤1 false alarm in 40 test images.
2. **Guideline Health that learns from reviewers.** A clarity score per rule from dismissals, exceptions and disagreements; drafted clearer rewrites with do/don't examples for the admin to approve; "False positive" dismissals remembered per brand so the same false alarm isn't raised again. Target: find the 3 planted vague rules; halve repeated false alarms.
3. **Real accounts and private mode.** Sign-in with roles and Postgres row-level security; masking of private words inside images before the vision AI; an option to use the company's own OpenAI-compatible AI server (e.g. Ollama). Target: 0 canary leaks including images; tests for every role's access rules.

## Disclosure

- Built by Tadoori Satwik (solo) with significant help from an AI coding assistant (**Claude**, Anthropic) for code, test data and documentation. All code was written in the Round 2 build window and reviewed by me.
- The demo brand **Aranya Naturals** and its rules, facts, prices and studies are fictional. The rulebook (`src/lib/seed-data.ts`) was prepared as test data.
- Open-source libraries are listed in `package.json`. AI provider: Google Gemini (optional).

## Project structure

```
src/
  app/                 pages (home, submissions, review, canon, insights, audit, about) + actions.ts (server actions)
  components/          Workspace (main review screen), NewSubmissionForm, CanonEditors, RoleSwitcher…
  lib/
    check/             rules.ts (code checks) · ai.ts (Gemini + verifier) · redact.ts · image.ts · index.ts (pipeline)
    store.ts           submissions, versions, findings, decisions, approvals, audit
    canon.ts           Brand Canon loading and fact status
    seed-data.ts       the fictional demo brand
    db.ts, schema.ts   Postgres / PGlite
scripts/               eval.ts, eval-heldout.ts, try-samples.ts, demo-verifier.ts, e2e/
```
