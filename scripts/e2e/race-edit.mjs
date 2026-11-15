// Regression: accept all fixes, then open Edit before the page refreshes and save.
// The accepted fixes must survive (the save only changes fields the person edited).
import puppeteer from "puppeteer-core";
const BASE = process.env.BASE || "http://localhost:3000";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"], defaultViewport: { width: 1440, height: 1000 } });
const page = await browser.newPage();
const click = (t) => page.evaluate((t) => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim().includes(t) && !x.disabled); if (!b) throw new Error("no button " + t); b.click(); }, t);
await page.goto(BASE, { waitUntil: "networkidle0" });
await page.evaluate(() => [...document.querySelectorAll("main button")].find((b) => b.textContent.includes("Rahul")).click());
await page.waitForNavigation({ waitUntil: "networkidle0" });
await page.goto(BASE + "/submissions", { waitUntil: "networkidle0" });
const href = await page.evaluate(() => [...document.querySelectorAll("a")].find((a) => a.textContent.includes("Neem cleanser launch post")).getAttribute("href"));
await page.goto(BASE + href, { waitUntil: "networkidle0" });
await click("Accept all");
await click("Edit");                      // immediately, before the refresh lands
await new Promise((r) => setTimeout(r, 300));
await click("designer");
await new Promise((r) => setTimeout(r, 1500)); // let accept-all finish on the server
await click("Save");
await page.waitForNetworkIdle({ idleTime: 600, timeout: 20000 }).catch(() => {});
await page.goto(BASE + href, { waitUntil: "networkidle0" });
const text = await page.evaluate(() => document.querySelector("main").innerText);
console.log("fixes kept:", text.includes("visibly fewer blemishes in 4 weeks") && !text.includes("Say goodbye to acne"));
console.log("image replaced:", text.includes("Clearer skin, naturally"));
await browser.close();
