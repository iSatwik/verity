import puppeteer from "puppeteer-core";
const BASE = process.env.BASE || "http://localhost:3000";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"], defaultViewport: { width: 1440, height: 1000 } });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("dialog", (d) => d.accept());
const shot = async (n) => { await page.screenshot({ path: `/tmp/shots/${n}.png`, fullPage: true }); console.log("shot", n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const idle = async () => { await wait(500); await page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 }).catch(() => {}); };
const clickText = async (text, sel = "button,label,a") => {
  const ok = await page.evaluate((text, sel) => { const el = [...document.querySelectorAll(sel)].find((b) => b.textContent.trim().includes(text) && !b.disabled); if (el) { el.click(); return true; } return false; }, text, sel);
  if (!ok) throw new Error("not found: " + text); await idle();
};
const body = () => page.evaluate(() => document.body.innerText);
const role = async (name) => { await page.goto(BASE, { waitUntil: "networkidle0" }); await clickText(name, "main button"); };

// A. New submission from a Word document
await role("Rahul");
await page.goto(BASE + "/submissions/new", { waitUntil: "networkidle0" });
const [chooser] = await Promise.all([page.waitForFileChooser(), clickText("Upload .docx", "button")]);
await chooser.accept([process.env.DOCX || "/tmp/newsletter.docx"]); await idle(); await wait(1000);
await page.select("select[name=channel]", "email");
console.log("doc text:", (await page.$eval("textarea[name=text]", (t) => t.value)).slice(0, 80));
await clickText("Run brand check", "button"); await page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {});
await shot("30-docx-checked");
let t = await body(); console.log("docx findings:", [...t.matchAll(/(Blocker|Major|Minor)\n([^\n]+)/g)].map((m) => m[1] + ": " + m[2]).join(" | "));
const docUrl = page.url();

// B. Exception path: accept fixes where possible, otherwise request exceptions / dismiss with a reason; re-check until clean
async function decideAll() {
  const fids = await page.$$eval("[id^=f-]", (els) => els.map((e) => e.id));
  for (const id of fids) {
    const info = await page.$eval(`#${id}`, (e) => ({ sev: e.querySelector("span")?.textContent, btns: [...e.querySelectorAll("button")].map((b) => b.textContent.trim()) }));
    if (info.btns.includes("Accept")) { await page.$eval(`#${id}`, (e) => [...e.querySelectorAll("button")].find((b) => b.textContent.trim() === "Accept").click()); await idle(); continue; }
    const btn = info.btns.includes("Ask for an exception") ? "Ask for an exception" : "Dismiss";
    if (!info.btns.includes(btn)) continue;
    await page.$eval(`#${id}`, (e, btn) => [...e.querySelectorAll("button")].find((x) => x.textContent.trim() === btn).click(), btn);
    await wait(200);
    await page.$eval(`#${id} select`, (s) => { const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; set.call(s, "Approved exception"); s.dispatchEvent(new Event("change", { bubbles: true })); });
    await page.type(`#${id} input`, "Legal confirmed with the supplier on call, proof coming");
    await page.$eval(`#${id}`, (e) => [...e.querySelectorAll("button")].find((b) => /^(Send exception request|Dismiss)$/.test(b.textContent.trim())).click());
    await idle();
  }
}
for (let round = 0; round < 4; round++) {
  await page.goto(docUrl, { waitUntil: "networkidle0" });
  await decideAll();
  await page.goto(docUrl, { waitUntil: "networkidle0" });
  await clickText("Run check", "button").catch(() => clickText("Check again", "button")); await wait(800);
  await page.goto(docUrl, { waitUntil: "networkidle0" });
  t = await body();
  if (/Ready to submit/.test(t)) break;
}
console.log("after decisions:", t.match(/(Needs fixes|Ready to submit)/)?.[0], t.match(/(\d+) blocker\/major issue/)?.[0] ?? "");
await shot("31-docx-decided");
await clickText("Submit for review", "button").catch((e) => console.log("submit:", e.message));
// C. Ritika requests changes
await role("Ritika");
await page.goto(docUrl, { waitUntil: "networkidle0" });
t = await body(); console.log("ritika sees exceptions:", /exception request/i.test(t));
await page.type("textarea[placeholder^='Note for the creator']", "Please remove the recyclable claim until Ops attaches proof.");
await clickText("Request changes", "button");
await page.goto(docUrl, { waitUntil: "networkidle0" }); t = await body(); console.log("status:", t.match(/(asked for changes)/)?.[0]);

// D. Admin edits the Canon: add a fact
await role("Satwik");
await page.goto(BASE + "/canon?tab=facts", { waitUntil: "networkidle0" });
const form = await page.$$("form");
const last = form[form.length - 1];
await last.$eval("input[name=id]", (i) => i.value = "");
await (await last.$("input[name=id]")).type("F-30");
await (await last.$("textarea[name=statement]")).type("Packaging is 100% recyclable (certificate RC-2026-11).");
await (await last.$("input[name=keywords]")).type("recyclable");
await (await last.$("input[name=source]")).type("Recycling certificate RC-2026-11");
await last.$eval("button", (b) => b.click()); await idle();
t = await body(); console.log("canon:", t.match(/Brand rules\s*v\d+/)?.[0], /F-30/.test(t));
await shot("32-canon-admin");
await browser.close();
console.log(errors.length ? errors.join("\n") : "no browser errors");
