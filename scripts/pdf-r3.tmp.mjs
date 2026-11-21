import puppeteer from "puppeteer-core";
const b = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.goto("file:///home/claude/r3/report.html", { waitUntil: "networkidle0" });
await p.pdf({ path: "/home/claude/r3/Verity_Round3_TeamKnox.pdf", format: "A4", printBackground: true, preferCSSPageSize: true });
await b.close();
