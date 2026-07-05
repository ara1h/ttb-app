/**
 * Generates the sample label images in public/samples.
 * Run: node scripts/generate-samples.mjs
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT_DIR = path.join(import.meta.dirname, "..", "public", "samples");

const WARNING_PREFIX = "GOVERNMENT WARNING:";
const WARNING_BODY =
  "(1) According to the Surgeon General, women should not drink alcoholic " +
  "beverages during pregnancy because of the risk of birth defects. " +
  "(2) Consumption of alcoholic beverages impairs your ability to drive a car " +
  "or operate machinery, and may cause health problems.";

function escapeXml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&apos;")
    .replace(/"/g, "&quot;");
}

function wrap(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    if (line && (line + " " + word).length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? line + " " + word : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function warningSvg({ prefix, y, width }) {
  const lines = wrap(`${prefix} ${WARNING_BODY}`, 74);
  return lines
    .map((line, i) => {
      const lineY = y + i * 20;
      if (i === 0 && line.startsWith(prefix)) {
        const rest = line.slice(prefix.length);
        return `<text x="${width / 2}" y="${lineY}" text-anchor="middle" font-family="Georgia, serif" font-size="15" fill="#2b2118"><tspan font-weight="bold">${escapeXml(prefix)}</tspan>${escapeXml(rest)}</text>`;
      }
      return `<text x="${width / 2}" y="${lineY}" text-anchor="middle" font-family="Georgia, serif" font-size="15" fill="#2b2118">${escapeXml(line)}</text>`;
    })
    .join("\n  ");
}

function labelSvg({
  brand,
  brandSize = 56,
  classType,
  abvLine,
  netContents,
  bottler,
  accent = "#7a2e1d",
  background = "#f5eeda",
  warningPrefix = WARNING_PREFIX,
  includeWarning = true,
}) {
  const W = 900;
  const H = 1150;
  const warning = includeWarning
    ? warningSvg({ prefix: warningPrefix, y: 985, width: W })
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${background}"/>
  <rect x="28" y="28" width="${W - 56}" height="${H - 56}" fill="none" stroke="${accent}" stroke-width="6"/>
  <rect x="44" y="44" width="${W - 88}" height="${H - 88}" fill="none" stroke="${accent}" stroke-width="2"/>
  <text x="${W / 2}" y="150" text-anchor="middle" font-family="Georgia, serif" font-size="26" letter-spacing="6" fill="#2b2118">EST. 1897</text>
  <line x1="200" y1="185" x2="${W - 200}" y2="185" stroke="${accent}" stroke-width="2"/>
  <text x="${W / 2}" y="300" text-anchor="middle" font-family="Georgia, serif" font-size="${brandSize}" font-weight="bold" letter-spacing="3" fill="${accent}">${escapeXml(brand)}</text>
  <line x1="200" y1="350" x2="${W - 200}" y2="350" stroke="${accent}" stroke-width="2"/>
  <text x="${W / 2}" y="470" text-anchor="middle" font-family="Georgia, serif" font-size="34" font-style="italic" fill="#2b2118">${escapeXml(classType)}</text>
  <circle cx="${W / 2}" cy="620" r="85" fill="none" stroke="${accent}" stroke-width="3"/>
  <text x="${W / 2}" y="605" text-anchor="middle" font-family="Georgia, serif" font-size="30" font-weight="bold" fill="${accent}">${escapeXml(abvLine.split(" ")[0])}</text>
  <text x="${W / 2}" y="645" text-anchor="middle" font-family="Georgia, serif" font-size="18" fill="#2b2118">Alc./Vol.</text>
  <text x="${W / 2}" y="775" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#2b2118">${escapeXml(abvLine)}</text>
  <text x="${W / 2}" y="825" text-anchor="middle" font-family="Georgia, serif" font-size="30" font-weight="bold" fill="#2b2118">${escapeXml(netContents)}</text>
  <text x="${W / 2}" y="890" text-anchor="middle" font-family="Georgia, serif" font-size="17" fill="#2b2118">${escapeXml(bottler)}</text>
  <line x1="120" y1="940" x2="${W - 120}" y2="940" stroke="${accent}" stroke-width="1.5"/>
  ${warning}
</svg>`;
}

const OLD_TOM = {
  brand: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  abvLine: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  bottler: "Distilled and bottled by Old Tom Distillery, Bardstown, Kentucky",
};

const SAMPLES = [
  { file: "old-tom-correct.png", spec: OLD_TOM },
  {
    file: "old-tom-abv-mismatch.png",
    spec: { ...OLD_TOM, abvLine: "43% Alc./Vol. (86 Proof)" },
  },
  {
    file: "old-tom-warning-titlecase.png",
    spec: { ...OLD_TOM, warningPrefix: "Government Warning:" },
  },
  {
    file: "stones-throw-case.png",
    spec: {
      brand: "STONE'S THROW",
      classType: "Straight Rye Whiskey",
      abvLine: "50% Alc./Vol. (100 Proof)",
      netContents: "750 mL",
      bottler: "Bottled by Stone's Throw Spirits Co., Portland, Oregon",
      accent: "#1d4a7a",
      background: "#eef2ef",
    },
  },
  {
    file: "high-desert-missing-warning.png",
    spec: {
      brand: "HIGH DESERT",
      classType: "Blended American Whiskey",
      abvLine: "40% Alc./Vol. (80 Proof)",
      netContents: "1 L",
      bottler: "Bottled by High Desert Beverage Co., Reno, Nevada",
      accent: "#8a6d1d",
      background: "#f7f2e4",
      includeWarning: false,
    },
  },
];

await mkdir(OUT_DIR, { recursive: true });

for (const { file, spec } of SAMPLES) {
  const svg = Buffer.from(labelSvg(spec));
  await sharp(svg).png().toFile(path.join(OUT_DIR, file));
  console.log("wrote", file);
}

// An imperfect photo: the correct label, rotated and slightly blurred.
const angled = Buffer.from(labelSvg(OLD_TOM));
await sharp(angled)
  .rotate(8, { background: "#d8d4cc" })
  .blur(1.1)
  .modulate({ brightness: 0.94 })
  .png()
  .toFile(path.join(OUT_DIR, "old-tom-photo-angled.png"));
console.log("wrote old-tom-photo-angled.png");
