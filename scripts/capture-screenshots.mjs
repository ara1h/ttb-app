/**
 * Captures the README screenshots by driving the deployed app with headless
 * Chrome. Run: node scripts/capture-screenshots.mjs [base-url]
 * Requires a local Chrome install (path via CHROME_PATH if non-standard).
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE_URL = process.argv[2] ?? "https://ttb-app.vercel.app";
const OUT_DIR = path.join(import.meta.dirname, "..", "docs", "screenshots");
const CHROME =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const SAMPLES_DIR = path.join(import.meta.dirname, "..", "public", "samples");

const SAMPLE_FILES = [
  "old-tom-correct.png",
  "old-tom-abv-mismatch.png",
  "old-tom-warning-titlecase.png",
  "stones-throw-case.png",
  "high-desert-missing-warning.png",
  "old-tom-photo-angled.png",
];

async function clickByText(page, selector, text) {
  await page.evaluate(
    (sel, t) => {
      const el = [...document.querySelectorAll(sel)].find((e) =>
        e.textContent.trim().startsWith(t),
      );
      if (!el) throw new Error(`No ${sel} with text "${t}"`);
      el.click();
    },
    selector,
    text,
  );
}

async function waitForText(page, text, timeout = 30_000) {
  await page.waitForFunction(
    (t) => document.body.innerText.includes(t),
    { timeout },
    text,
  );
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1.25 });
await mkdir(OUT_DIR, { recursive: true });

console.log("Opening", BASE_URL);
await page.goto(BASE_URL, { waitUntil: "networkidle2" });

// 1. Single check — clean pass.
await clickByText(page, "button", "Clean pass");
await waitForText(page, "old-tom-correct.png"); // sample finished loading
await clickByText(page, "button", "Check this label");
await waitForText(page, "All checks passed");
await page.screenshot({ path: path.join(OUT_DIR, "single-check-pass.png") });
console.log("wrote single-check-pass.png");

// 2. Single check — title-case government warning rejected.
await clickByText(page, "button", "Warning not in caps");
await waitForText(page, "old-tom-warning-titlecase.png");
await clickByText(page, "button", "Check this label");
await waitForText(page, "Issues found");
await page.screenshot({ path: path.join(OUT_DIR, "single-check-warning-fail.png") });
console.log("wrote single-check-warning-fail.png");

// 3. Batch mode — six labels with the demo CSV.
await clickByText(page, '[role="tab"]', "Check a batch");
const inputs = await page.$$('input[type="file"]');
// First file input accepts images, second accepts the CSV.
await inputs[0].uploadFile(...SAMPLE_FILES.map((f) => path.join(SAMPLES_DIR, f)));
await inputs[1].uploadFile(path.join(SAMPLES_DIR, "sample-batch.csv"));
await waitForText(page, "details for 6 file(s)");
await clickByText(page, "button", "Check 6 labels");
await waitForText(page, "Done:", 90_000);
await page.screenshot({
  path: path.join(OUT_DIR, "batch-results.png"),
  fullPage: true,
});
console.log("wrote batch-results.png");

await browser.close();
console.log("Screenshots saved to docs/screenshots/");
