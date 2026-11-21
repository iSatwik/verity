# Verity: brand checks before you publish

**Team Knox (Tadoori Satwik) · CodeNova India 2026 · Problem statement by Inkloom AI (brand governance)**

Verity checks content **before it is published** (a social post, an ad, an email, a Word/PDF document or an image) against a brand's approved **rules, facts, words and visual identity**. Every issue shows **the exact rule or fact it breaks** and **a suggested fix**, and **a person makes the final approval**.

> The demo brand **Aranya Naturals** is *fictional*. Its products, prices, studies and people are made up.

- **Live demo:** https://verity-swart-ten.vercel.app
- **Source:** https://github.com/iSatwik/verity
- **Sign in:** click any of the four demo people on the sign-in page (one click), or use their email with the password `aranya-demo`.

| Person | Email | Role |
|---|---|---|
| Rahul K. | rahul@aranya.demo | Content creator |
| Ritika S. | ritika@aranya.demo | Brand manager |
| Arjun V. | arjun@aranya.demo | Compliance reviewer |
| Satwik | satwik@aranya.demo | Brand admin |

---

## Try it in 3 minutes

1. Open the live link and click **Rahul K. (Content creator)**.
2. Open **Neem cleanser launch post**. Each underlined part is an issue, grouped as **Must fix / Should fix / Nice to fix**, and each one links to its rule (`C-1.2`, `F-12`, `T-02`…).
3. Look at the **Image** panel. The contrast of every line of text in the image is measured (the red line fails 4.5 : 1), along with the brand colours, the alt text and the words read from the image.
4. Click **Accept all … suggestions**, then **Edit → Use the designer's corrected image (demo) → Save**, then **Check again**. Then click **Submit for review**. The post has claims, so it needs the brand manager **and** compliance.
5. Open the menu at the top right and switch to **Arjun V.**, then click **Approve**. Then switch to **Ritika S.** and click **Approve**. The version is locked with a SHA-256 review record.
6. Switch to **Satwik (Brand admin)** and open **Rule health**. Three rules people keep pushing back on are flagged, each with a suggested clearer wording you can review and apply.
7. Open the menu at the top right and **Sign out**. Every page now asks you to sign in. Creators can only ever see their own submissions; the database enforces this (see `npm run test:access`).

## What's new in Round 3

### 1. Better image checks
- **Text in images is read on our own server** with OCR (tesseract.js), which gives a box for every word. There's no AI call and no extra cost.
- **Contrast is measured on each line of text**, not estimated from the main colours of the image. Inside each word box, the pixels are split into text and background, and the core text pixels are compared with the background using WCAG's formula. Large text needs 3 : 1; other text needs 4.5 : 1. The panel lists every line with its ratio.
- **Logo checks.** The vision AI finds the logo's box; code then checks four things:
  - **stretched:** the shape is off by more than 12%
  - **recoloured:** CIEDE2000 colour difference above 20 from the logo greens
  - **too small:** under 8% of the image width
  - **no clear space:** text within a quarter of the logo's width
- **Fewer false warnings.** The contrast estimate used to give 3 false alarms on clean test images; measuring gives 0.

### 2. Rule health
- Every decision on a warning is counted per rule: accepted, dismissed, false alarm, "rule is unclear", exception.
- Each rule gets a **clarity score** once it has 4 or more decisions. Rules under 50 are marked *unclear*, and rules under 75 *need attention*.
- Unclear rules get a **suggested clearer wording**, built from real cases: the fixes people accepted and the wording they pushed back on, with do/don't examples. The admin reviews, edits and applies it as a new rule version. After a rewrite, the score starts again from new decisions.
- **False alarms are remembered.** When someone marks a warning as "False positive", the same rule and wording are not flagged again. The admin can see the list and bring a warning back. Must-fix issues are never hidden this way.

### 3. Real accounts and privacy
- **Sign-in with email and password.**
  - Passwords are stored as salted **scrypt** hashes.
  - The session cookie is **HMAC-signed**, http-only, and lasts 7 days. Editing it to change your role makes it invalid.
  - 5 wrong passwords lock that email for 10 minutes.
  - One-click demo sign-in uses the same password check, and can be turned off (`DEMO_SIGNIN=off`).
- **Access limits inside the database (Postgres row-level security).** Each query from a signed-in person runs in its own transaction as `verity_rls`, a role that cannot bypass these rules. The person's role and id are set for that one transaction. So even a bug in the app code can't break these limits:

| Who | Can | Cannot |
|---|---|---|
| Creator | see and edit only **their own** submissions, findings, comments and AI calls | see others' drafts, change brand rules, approve, or write audit entries as someone else |
| Manager / Compliance | see all submissions, approve **as themselves** | approve in someone else's name, change brand rules |
| Admin | change brand rules, facts, terms; read the whole AI call log | edit or delete the audit log |
| Everyone | — | read password hashes; edit or delete audit entries (the audit log is append-only) |
| Signed out | — | read anything |

- **Private words inside images are hidden before the AI sees them.**
  - OCR finds lines containing confidential terms, emails, phone numbers or card numbers, and those lines are pixelated before the image goes to the vision AI.
  - The whole line is hidden, not just the matched word, because OCR sometimes misreads one part.
  - Code still checks the original text.
  - If OCR fails, the image is not sent to a hosted AI at all, because it couldn't be checked for private words first.
- **Company AI server option.** Set `AI_BASE_URL` to any OpenAI-compatible server (Ollama, vLLM, LM Studio, LiteLLM) and Verity uses it for all text and image AI work. Then **no content leaves the company**. The About page shows which AI is in use.

### Loose ends closed
- **Fixed: offer-terms loop.** Accepting the "offer is missing terms" fix could add "T&C apply." again and again, because the suggestion didn't add the missing end date. Verity now only offers a fix that actually satisfies the rule; otherwise it asks for the date.
- **Fixed: repeated carry-over notes.** Exception notes carried over to the next version added "(carried over…)" again each time.
- **Fixed: blurring wasn't applied.** Image blurring was silently not happening (sharp keeps only the last `resize()` in one pipeline). The new privacy test caught this.
- **Robustness:**
  - Every action refuses to run without a valid session.
  - Two edits made at the same time are merged, not lost (`race-edit` test).
  - Buttons are disabled while their action runs, so a double click doesn't do it twice.
  - Lists show a clear empty state.
  - Reset demo is admin-only.

## Complete feature list

| Area | What works |
|---|---|
| **Accounts** | Email + password sign-in, signed sessions, lock-out, sign out, one-click demo people, access limits enforced in Postgres |
| **Brand rules** | Rules (voice, messaging, claims, visual, accessibility, disclosure), approved facts with source, owner, valid-from/until and status, terminology (brand/product names, banned and preferred words), colour palette, confidential terms. Admin add/edit/delete; every change raises the rules version and is logged. Import a guideline document (.docx/.pdf/.txt) as draft rules. |
| **Content intake** | Paste text, upload .docx / .pdf / .txt, attach an image (PNG/JPG/WebP). Channels: Instagram, influencer, ad, email, website, press release, document. Sample posts. |
| **Text checks (code)** | Wrong brand/product names · banned phrases · result claims vs approved facts (including the timeframe) · superlatives · comparisons · numbers vs facts · prices vs the current price list (expired prices caught) · delivery terms · claims relying on unproven facts · offer end date + T&C · paid-post disclosure · confidential terms · tone (pushy phrases, "!!", emojis, ALL CAPS) · Hinglish in formal channels · vague link text · hashtags · long sentences |
| **Image checks** | Words read by OCR, contrast measured per line, brand colours (CIEDE2000), logo stretched / recoloured / too small / no clear space, missing alt text with a suggestion, image text checked like the caption |
| **AI (optional, verified)** | Tone, messaging and claim review plus an intent card. The AI must cite a rule/fact ID and quote it; code verifies both, otherwise the finding becomes a grey advisory that can never block. Private data is masked in text and hidden in images first. Hosted AI or the company's own server. |
| **Explain & fix** | Highlights in the text, severity, the rule/fact text, a suggested fix. Accept, edit & accept, accept all, or dismiss with a reason. Must-fix issues can only become exception requests that a reviewer approves. Decisions carry over to re-checks. |
| **Review & approval** | Routing by risk: standard → brand manager; claims/offers/disclosures → manager **and** compliance. Approve, request changes, approve with exception (notes required). Approval locks the version (SHA-256, rules version, approvers, time). Reopen for changes. |
| **Rule health** | Clarity score per rule, suggested clearer wording the admin can apply, remembered false alarms with undo |
| **Collaboration** | Comments, including on a selected line. Version history with word-level diffs. Activity timeline. |
| **Audit & AI log** | Every check, fix, dismissal, comment, approval, sign-in and rule change is logged (append-only). Every AI call is logged with the masked text that was sent. |
| **Insights** | Most broken rules, issues by type and channel, why findings get dismissed, facts expired/expiring/without proof |

## Testing

All tests run from a fresh clone (no keys needed except where noted).

| Test | Command | Result |
|---|---|---|
| Text checks, labelled set (13 posts, 37 issues) | `npm run eval` | 100% found, 100% correct. Written together with the rules, so optimistic. |
| Text checks, held-out set (5 posts written later) | `npm run eval` | 8/9 found, 8/8 correct. Miss: "blocks 100% of UV rays" (left to the AI layer). |
| Image colour + contrast (20 generated ads with planted errors, plus clean ones) | `npm run eval:images` | **18/20 planted errors caught, 0/20 false alarms** (the old estimate: 3 false alarms). Misses: a red and an orange background read as shades of the brand saffron. |
| Logo checks (10 composited images) | `npm run eval:images` | **8/8 logo problems caught, 0/32 false alarms** |
| Rule health on 30 days of decision history | `npm run eval:rules` | **3/3 planted vague rules found**, 0 clear rules flagged; false-alarm memory 6/6 cases; repeated false alarms **5 → 0** |
| Access limits (real schema + policies) | `npm run test:access` | **38/38**: every role's allowed and blocked actions, append-only audit log, password hashes unreadable, forged admin cookie rejected |
| Company AI server | `npm run test:company-ai` | 7/7: all text and image AI calls go to the configured server; **0 requests to any other host** |
| Private data in text (17 posts with canary values) | `npm run eval:confidential` | 0 canary leaks in the exact AI prompt (18 values masked) |
| Private words inside images (6 images with secrets + 3 clean) | `npm run eval:image-privacy` | **0 secrets readable after hiding**, 6/6 found, 0/3 clean images wrongly hidden |
| End-to-end in a real browser (Puppeteer) | `node scripts/e2e/*.mjs` against `npm start` | **full-flow** (creator fixes → compliance + manager approve → locked) · **exceptions-and-canon** (.docx upload, exception requests, changes requested, admin edits a rule) · **race-edit** (two edits at once, nothing lost) · **creator-flow**. All pass, no browser errors. |

Honest limits: the image targets from Round 2 were ≥95% caught and ≤1 false alarm in 40. We reached 26/28 = 93% caught (colour + contrast + logo) with 0 false alarms in 52 clean checks. Test sets are generated; real customer creatives will be harder. A formal user test with 5 people was planned but not done in this window.

## How it works

```
Sign in (scrypt + signed cookie) ─► every query runs as verity_rls with the person's role (row-level security)

Creator ─► New submission (text / .docx / .pdf / image)
              │
              ▼
  Image: OCR on our server ─► hide private lines ─► vision AI (logo box, alt text)
         ─► contrast per line · brand colours · logo checks
  Text:  code checks ─► mask private data ─► AI review (hosted or company server)
         ─► citation verifier (rule/fact must exist and be quoted)
  False-alarm memory hides known wrong warnings (never must-fix ones)
              │
              ▼
  Findings (cite rule/fact IDs) ─► accept / edit / dismiss / exception ─► feedback per rule
              │                                                              │
              ▼                                                              ▼
  Route by risk ─► Manager (+ Compliance) ─► Approved & locked     Rule health ─► admin applies clearer wording
              │
              ▼
  Audit log (append-only) · AI call log · Insights · rule versions
```

## Tech stack

| Part | Choice |
|---|---|
| App | Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS 4 |
| Database | Supabase Postgres via postgres.js, with row-level security; PGlite (in-process Postgres) for local runs and tests |
| Auth | Node crypto: scrypt passwords, HMAC-SHA256 session cookie |
| AI | Gemini (hosted) or any OpenAI-compatible server (Ollama, vLLM…), JSON output, temperature 0 |
| Images | tesseract.js (OCR on the server), sharp (pixels, hiding), culori (CIEDE2000, WCAG contrast) |
| Documents | mammoth (.docx), unpdf (.pdf) |
| Testing | tsx scripts (accuracy, access, privacy), Puppeteer end-to-end flows |
| Hosting | Vercel (Mumbai region) |

## Run locally (no accounts or keys needed)

```bash
git clone https://github.com/iSatwik/verity.git
cd verity
npm install
npm run dev           # http://localhost:3000 (local Postgres in ./.data, demo data created automatically)
```

Sign in with one click as any demo person. Without an AI key, every code check (text, image colours, contrast, OCR, privacy) still works; only the AI review and logo box need an AI.

Run the tests:

```bash
npm run eval && npm run eval:images && npm run eval:rules
npm run test:access && npm run test:company-ai
npm run eval:confidential && npm run eval:image-privacy
npm run build && npm start &              # then, in another terminal:
node scripts/e2e/full-flow.mjs           # needs Chrome at /usr/bin/google-chrome
```

## Configuration

Copy `.env.example` to `.env.local`. All settings are optional.

| Variable | What it does |
|---|---|
| `DATABASE_URL` | Postgres connection string (Supabase transaction pooler, port 6543). Empty = local PGlite. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Hosted AI for review, intent and images. |
| `AI_BASE_URL`, `AI_MODEL`, `AI_VISION_MODEL`, `AI_API_KEY`, `AI_TIMEOUT_MS` | The company's own OpenAI-compatible AI server. When set, it replaces the hosted AI. Example: `AI_BASE_URL=http://localhost:11434/v1`, `AI_MODEL=llama3.2-vision` for Ollama. |
| `AUTH_SECRET` | Secret for signing session cookies (32+ characters). |
| `DEMO_SIGNIN` | `off` removes one-click demo sign-in. |

**Deploy:** create a Supabase project, put its pooler URL in `DATABASE_URL` on Vercel, and deploy. Tables, access rules and demo data are created on first visit. If the app's database user can't create roles, run once as an admin:

```sql
CREATE ROLE verity_rls NOLOGIN NOBYPASSRLS;
GRANT verity_rls TO <app user>;
GRANT USAGE ON SCHEMA <app schema> TO verity_rls;
```

## Roadmap

| When | What |
|---|---|
| Next 1 month | Pilot with 2–3 small D2C brands and agencies, with a user test of 5 people per role. Single sign-on (Google Workspace, Microsoft). Invite people and set roles from the admin screen. |
| 3 months | Several brands per agency workspace. Brand onboarding: upload a brand book PDF and get draft rules, facts and palette to approve. Slack/Teams approvals. Plug-ins for Canva and Google Docs so checks run where people write. |
| 6 months | Checks before scheduling in Buffer / Hootsuite / Meta Business Suite. Video (frames + captions) and audio (transcripts). Better image recognition for real product photos. Search across large guideline sets (pgvector). |
| 12 months | Region-specific claim rules (ASCI, FSSAI, CDSCO for India). Insights across brands. On-premise package with a bundled local AI model. Audit export for regulated teams. |

**Business model:** per-seat pricing for brand teams, per-brand pricing for agencies, and an on-premise tier for regulated companies.

## Disclosure

- Built by Tadoori Satwik (solo), with significant help from an AI coding assistant (Claude, by Anthropic) for code, test data and documentation. All Round 3 work was done in the Round 3 window, and the git history shows it.
- The demo brand Aranya Naturals and its rules, facts, prices and studies are fictional.
- Open-source libraries are listed in `package.json`.

## Project structure

```
src/
  app/                 pages (submissions, review, canon, rule-health, insights, audit, about) + actions.ts
  components/          Workspace (review screen), RoleGate (sign-in), RuleHealthList, CanonEditors…
  lib/
    auth.ts, session.ts      passwords, signed sessions
    db.ts, schema.ts         Postgres / PGlite, row-level security policies
    check/                   rules.ts (code checks) · ai.ts (AI + verifier) · redact.ts · vision.ts (OCR, contrast, logo, hiding) · image*.ts
    rule-health.ts           clarity score, suggested wording, false-alarm memory
    store.ts                 submissions, versions, findings, decisions, approvals, audit
scripts/               eval*.ts, test-access.ts, test-company-ai.ts, eval-image-privacy.ts, e2e/
```
