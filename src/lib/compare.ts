import { canonical, cleaned, similarity } from "./normalize";
import { checkGovernmentWarning } from "./warning";
import type {
  ApplicationData,
  ExtractedLabel,
  FieldResult,
  FieldVerdict,
  OverallVerdict,
  VerificationResult,
} from "./types";

/**
 * Deterministic comparison engine. The AI extracts what the label says;
 * every pass/fail decision is made here, in reviewable code — so compliance
 * rules can be audited and adjusted without touching the model.
 */

/** Similarity threshold below which a text field is a clear mismatch. */
const REVIEW_THRESHOLD = 0.8;

function textFieldResult(
  field: string,
  label: string,
  appValue: string | undefined,
  labelValue: string | null,
): FieldResult {
  const base = {
    field,
    label,
    applicationValue: appValue?.trim() || null,
    labelValue,
  };
  if (!appValue?.trim()) {
    return {
      ...base,
      verdict: "skipped",
      detail: "No application value provided — not checked.",
    };
  }
  if (!labelValue?.trim()) {
    return {
      ...base,
      verdict: "missing",
      detail: `"${appValue.trim()}" appears in the application but was not found on the label.`,
    };
  }

  const app = cleaned(appValue);
  const found = cleaned(labelValue);

  if (app === found) {
    return { ...base, verdict: "match", detail: "Exact match." };
  }
  if (canonical(app) === canonical(found)) {
    // Same words — only capitalization/punctuation differ (e.g. STONE'S THROW
    // vs Stone's Throw). Treated as a match, with the difference noted.
    return {
      ...base,
      verdict: "close_match",
      detail: `Same name — differs only in capitalization or punctuation ("${found}" on label vs "${app}" in application).`,
    };
  }
  const score = similarity(canonical(app), canonical(found));
  if (score >= REVIEW_THRESHOLD) {
    return {
      ...base,
      verdict: "review",
      detail: `Similar but not identical ("${found}" on label vs "${app}" in application). Please review.`,
    };
  }
  return {
    ...base,
    verdict: "mismatch",
    detail: `Label shows "${found}" but the application says "${app}".`,
  };
}

/** Parse ABV percent and proof from free-form alcohol content text. */
export function parseAlcoholContent(
  text: string,
): { abv: number | null; proof: number | null } {
  const abvMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
  const proofMatch = text.match(/(\d+(?:\.\d+)?)\s*proof/i);
  let abv = abvMatch ? parseFloat(abvMatch[1]) : null;
  const proof = proofMatch ? parseFloat(proofMatch[1]) : null;
  if (abv === null && proof === null) {
    // A bare number like "45" is taken as percent ABV.
    const bare = text.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
    if (bare) abv = parseFloat(bare[1]);
  }
  if (abv === null && proof !== null) abv = proof / 2;
  return { abv, proof };
}

function compareAlcoholContent(
  appValue: string | undefined,
  labelValue: string | null,
): FieldResult {
  const base = {
    field: "alcoholContent",
    label: "Alcohol Content",
    applicationValue: appValue?.trim() || null,
    labelValue,
  };
  if (!appValue?.trim()) {
    return {
      ...base,
      verdict: "skipped",
      detail: "No application value provided — not checked.",
    };
  }
  if (!labelValue?.trim()) {
    return {
      ...base,
      verdict: "missing",
      detail: "Alcohol content was not found on the label.",
    };
  }

  const app = parseAlcoholContent(appValue);
  const found = parseAlcoholContent(labelValue);

  if (app.abv === null) {
    return {
      ...base,
      verdict: "review",
      detail: `Could not read a percentage from the application value "${appValue.trim()}". Please review manually.`,
    };
  }
  if (found.abv === null) {
    return {
      ...base,
      verdict: "review",
      detail: `Could not read a percentage from the label text "${labelValue.trim()}". Please review manually.`,
    };
  }
  if (Math.abs(app.abv - found.abv) > 0.05) {
    return {
      ...base,
      verdict: "mismatch",
      detail: `Label shows ${found.abv}% ABV but the application says ${app.abv}%.`,
    };
  }
  // Cross-check proof against ABV when the label states both (proof = 2 × ABV).
  if (found.proof !== null && Math.abs(found.proof - 2 * found.abv) > 0.1) {
    return {
      ...base,
      verdict: "review",
      detail: `ABV matches, but the label's proof (${found.proof}) is inconsistent with its ABV (${found.abv}% → expected ${2 * found.abv} proof).`,
    };
  }
  return {
    ...base,
    verdict: "match",
    detail: `Alcohol content matches (${app.abv}% ABV${found.proof !== null ? `, ${found.proof} proof consistent` : ""}).`,
  };
}

const ML_PER_UNIT: Record<string, number> = {
  ml: 1,
  cl: 10,
  l: 1000,
  liter: 1000,
  litre: 1000,
  "fl oz": 29.5735,
  oz: 29.5735,
};

/** Parse net contents to milliliters. Returns null when unparseable. */
export function parseNetContents(text: string): number | null {
  const match = cleaned(text)
    .toLowerCase()
    .match(/(\d+(?:[.,]\d+)?)\s*(fl\.?\s*oz\.?|oz\.?|ml|cl|l\b|liters?|litres?)/i);
  if (!match) return null;
  const qty = parseFloat(match[1].replace(",", "."));
  let unit = match[2].replace(/\./g, "").replace(/\s+/g, " ").trim();
  if (unit.startsWith("fl")) unit = "fl oz";
  if (unit.startsWith("liter") || unit.startsWith("litre")) unit = "l";
  const factor = ML_PER_UNIT[unit];
  return factor ? qty * factor : null;
}

function compareNetContents(
  appValue: string | undefined,
  labelValue: string | null,
): FieldResult {
  const base = {
    field: "netContents",
    label: "Net Contents",
    applicationValue: appValue?.trim() || null,
    labelValue,
  };
  if (!appValue?.trim()) {
    return {
      ...base,
      verdict: "skipped",
      detail: "No application value provided — not checked.",
    };
  }
  if (!labelValue?.trim()) {
    return {
      ...base,
      verdict: "missing",
      detail: "Net contents were not found on the label.",
    };
  }

  const app = parseNetContents(appValue);
  const found = parseNetContents(labelValue);
  if (app === null || found === null) {
    const side = app === null ? `application value "${appValue.trim()}"` : `label text "${labelValue.trim()}"`;
    return {
      ...base,
      verdict: "review",
      detail: `Could not read a volume from the ${side}. Please review manually.`,
    };
  }
  // Small tolerance covers unit conversions (e.g. 750 mL vs 25.4 fl oz).
  if (Math.abs(app - found) / Math.max(app, found) > 0.01) {
    return {
      ...base,
      verdict: "mismatch",
      detail: `Label shows ${labelValue.trim()} (≈${Math.round(found)} mL) but the application says ${appValue.trim()} (≈${Math.round(app)} mL).`,
    };
  }
  const note =
    cleaned(appValue).toLowerCase() === cleaned(labelValue).toLowerCase()
      ? "Net contents match."
      : `Net contents match (${labelValue.trim()} ≡ ${appValue.trim()}).`;
  return { ...base, verdict: "match", detail: note };
}

const VERDICT_SEVERITY: Record<FieldVerdict, number> = {
  match: 0,
  skipped: 0,
  close_match: 1,
  review: 2,
  missing: 3,
  mismatch: 3,
};

export function overallVerdict(
  fields: FieldResult[],
  legibility: ExtractedLabel["legibility"],
): OverallVerdict {
  if (legibility === "unreadable") return "unreadable";
  const worst = Math.max(...fields.map((f) => VERDICT_SEVERITY[f.verdict]));
  if (worst >= 3) return "fail";
  if (worst === 2) return "review";
  return "pass";
}

/** Run all field checks against an extracted label. */
export function verifyLabel(
  application: ApplicationData,
  extracted: ExtractedLabel,
): VerificationResult {
  const fields: FieldResult[] = [
    textFieldResult("brandName", "Brand Name", application.brandName, extracted.brandName),
    textFieldResult("classType", "Class / Type", application.classType, extracted.classType),
    compareAlcoholContent(application.alcoholContent, extracted.alcoholContent),
    compareNetContents(application.netContents, extracted.netContents),
    checkGovernmentWarning(extracted.governmentWarning),
  ];
  return {
    overall: overallVerdict(fields, extracted.legibility),
    fields,
    legibility: extracted.legibility,
    legibilityNotes: extracted.legibilityNotes,
  };
}
