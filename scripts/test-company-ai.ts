// Proves the "company AI server" option: with AI_BASE_URL set, every AI request goes to that server
// (OpenAI-compatible chat/completions) and nothing goes to an outside AI service.
// Run: npm run test:company-ai
import http from "node:http";

const seen: { path: string; auth?: string; body: { model: string; messages: { content: { type: string }[] }[] } }[] = [];
const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw);
    seen.push({ path: req.url ?? "", auth: req.headers.authorization, body });
    const hasImage = body.messages[0].content.some((c: { type: string }) => c.type === "image_url");
    const answer = hasImage
      ? { text_in_image: "Glow in 7 days", alt_text: "A cleanser bottle on a green background.", logo: { present: false } }
      : { intent: { goal: "Sell the cleanser", audience: "Oily skin", key_message: "Gentle neem cleanser", cta: "Shop now" }, issues: [{ category: "tone", source_id: "V-04", source_quote: "friendly, not casual", content_quote: "Hey gorgeous", severity: "minor", explanation: "Too casual.", suggestion: "Hi there," }] };
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer) } }] }));
  });
});

async function main() {
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  process.env.AI_BASE_URL = `http://127.0.0.1:${port}/v1`;
  process.env.AI_MODEL = "company-model";
  process.env.AI_API_KEY = "internal-token";
  process.env.GEMINI_API_KEY = "should-not-be-used";
  const outside: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.startsWith(process.env.AI_BASE_URL!)) outside.push(url);
    return realFetch(input, init);
  }) as typeof fetch;

  const { aiProvider, aiReview, aiDescribeImage } = await import("../src/lib/check/ai");
  const canon = {
    rules: [{ id: "V-04", category: "voice", title: "Friendly", body: "Sound friendly, not casual.", severity: "minor" }],
    facts: [], terms: [], palette: [], products: [], confidential: [], version: 1,
  } as never;
  const logs: { model: string; ok: boolean }[] = [];
  const text = "Hey gorgeous, try our neem cleanser.";
  const r = await aiReview({ maskedText: text, originalText: text, map: {}, channel: "instagram", canon, already: [], log: (l) => logs.push(l) });
  const img = await aiDescribeImage("data:image/png;base64,iVBORw0KGgo=", (l) => logs.push(l));

  const checks: [string, boolean][] = [
    ["provider is the company server", aiProvider() === "company"],
    ["text review went to /v1/chat/completions", seen[0]?.path === "/v1/chat/completions"],
    ["the configured model and key were used", seen[0]?.body.model === "company-model" && seen[0]?.auth === "Bearer internal-token"],
    ["the AI finding was verified against the rule and kept", r.findings.length === 1 && r.findings[0].sources[0]?.id === "V-04"],
    ["image description also went to the company server", seen.length === 2 && seen[1].body.messages[0].content.some((c) => c.type === "image_url") && img?.alt_text?.includes("cleanser") === true],
    ["the AI log names the company server", logs.every((l) => l.ok && l.model.includes("company server"))],
    ["no request went to any other host", outside.length === 0],
  ];
  let fail = 0;
  for (const [n, ok] of checks) { if (!ok) fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}`); }
  console.log(`\n${checks.length - fail} passed, ${fail} failed`);
  server.close();
  process.exit(fail ? 1 : 0);
}
main();
