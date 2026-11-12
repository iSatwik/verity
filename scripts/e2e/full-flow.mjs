import puppeteer from "puppeteer-core";
const BASE = process.env.BASE || "http://localhost:3000";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"], defaultViewport: { width: 1440, height: 1000 } });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
const shot = async (n) => { await page.screenshot({ path: `/tmp/shots/${n}.png`, fullPage: true }); console.log("shot", n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const idle = async () => { await wait(500); await page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 }).catch(() => {}); };
const clickText = async (text, sel = "button,label") => {
  const ok = await page.evaluate((text, sel) => { const el = [...document.querySelectorAll(sel)].find((b) => b.textContent.trim().includes(text) && !b.disabled); if (el) { el.click(); return true; } return false; }, text, sel);
  if (!ok) throw new Error("not found: " + text);
  await idle();
};
const body = () => page.evaluate(() => document.body.innerText);
const role = async (name) => { await page.goto(BASE, { waitUntil: "networkidle0" }); await clickText(`Continue as ${name}`); await page.waitForNetworkIdle({ idleTime: 500 }).catch(() => {}); };

await role("Rahul");
await page.goto(BASE + "/submissions", { waitUntil: "networkidle0" });
const href = await page.evaluate(() => [...document.querySelectorAll("a")].find((a) => a.textContent.includes("Neem cleanser launch post")).getAttribute("href"));
const url = BASE + href;
await page.goto(url, { waitUntil: "networkidle0" });
await clickText("Accept all");
await clickText("Edit content");
await clickText("Use the designer");
await wait(800);
await clickText("Save changes");
await clickText("Run check again"); await wait(800);
await page.goto(url, { waitUntil: "networkidle0" });
await shot("10-creator-fixed");
let t = await body();
console.log("status line:", t.match(/(Needs fixes|Ready to submit|In review)/)?.[0], "| open:", t.match(/Findings\s*\n?(\d+) blocker/)?.[1]);
await clickText("Submit for review");
await page.goto(url, { waitUntil: "networkidle0" });
t = await body(); console.log("after submit:", t.match(/(In review|Needs fixes|Ready to submit)/)?.[0]);

await role("Arjun");
await page.goto(BASE + "/review", { waitUntil: "networkidle0" }); await shot("11-arjun-queue");
await page.goto(url, { waitUntil: "networkidle0" });
await page.type("textarea[placeholder^='Note for the creator']", "Claims match F-12 and F-07. OK from compliance.");
await clickText("Approve");
await role("Ritika");
await page.goto(url, { waitUntil: "networkidle0" });
await page.type("textarea[placeholder^='Note for the creator']", "On brand now. Approved.");
await clickText("Approve");
await page.goto(url, { waitUntil: "networkidle0" });
await shot("12-approved");
t = await body(); console.log("final:", t.match(/Approved and locked[^\n]*/)?.[0], t.match(/sha256 [0-9a-f]{12}/)?.[0]);

// comment as Ritika on a selection
await page.evaluate(() => { const m = document.querySelector(".whitespace-pre-wrap"); const r = document.createRange(); r.selectNodeContents(m.firstChild); const s = getSelection(); s.removeAllRanges(); s.addRange(r); m.dispatchEvent(new MouseEvent("mouseup", { bubbles: true })); });
await wait(300);
await page.type("textarea[placeholder^='Comment as']", "Love the new creative.");
await clickText("Post comment");
// other pages
for (const p of ["/insights", "/audit", "/canon", "/canon?tab=facts", "/review", "/about"]) { await page.goto(BASE + p, { waitUntil: "networkidle0" }); await shot("20" + p.replace(/[/?=]/g, "_")); }
await browser.close();
console.log(errors.length ? errors.join("\n") : "no browser errors");
