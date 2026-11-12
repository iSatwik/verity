import puppeteer from "puppeteer-core";
const BASE = process.env.BASE || "http://localhost:3000";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"], defaultViewport: { width: 1440, height: 1000 } });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
const shot = async (n) => { await page.screenshot({ path: `/tmp/shots/${n}.png`, fullPage: true }); console.log("shot", n); };
const clickText = async (text, sel = "button") => {
  const ok = await page.evaluate((text, sel) => { const el = [...document.querySelectorAll(sel)].find((b) => b.textContent.trim().includes(text) && !b.disabled); if (el) { el.click(); return true; } return false; }, text, sel);
  if (!ok) throw new Error("not found: " + text);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const idle = async () => { await wait(400); await page.waitForNetworkIdle({ idleTime: 400, timeout: 20000 }).catch(() => {}); };

await page.goto(BASE, { waitUntil: "networkidle0" }); await shot("01-home");
await clickText("Rahul", "main button"); await page.waitForNavigation({ waitUntil: "networkidle0" }); await shot("02-submissions");
const demoHref = await page.evaluate(() => [...document.querySelectorAll("a")].find((a) => a.textContent.includes("Neem cleanser launch post")).getAttribute("href"));
await page.goto(BASE + demoHref, { waitUntil: "networkidle0" }); await shot("03-demo-post");
await clickText("Accept all"); await idle(); await shot("04-after-accept-all");
await clickText("Use this alt text").catch(() => console.log("no alt button")); await idle();
await clickText("Run check").catch(() => clickText("Check again")); await idle(); await wait(500); await shot("05-rechecked");
// handle remaining open issues
const remaining = await page.evaluate(() => document.body.innerText.match(/(\d+) blocker\/major issue/)?.[1]);
console.log("remaining blocker/major:", remaining);
await browser.close();
console.log(errors.length ? errors.join("\n") : "no browser errors");
