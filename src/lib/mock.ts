import type { ExtractedLabel } from "./types";
import { GOVERNMENT_WARNING_FULL } from "./warning";

/**
 * Canned extractions for the bundled sample labels, keyed by file name stem.
 * Used only when ANTHROPIC_API_KEY is not set, so the app can be explored
 * offline. Every mock response is clearly flagged in the UI.
 */

const OLD_TOM_BASE: Omit<ExtractedLabel, "governmentWarning" | "legibility" | "legibilityNotes"> = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  bottlerNameAddress: "Distilled and bottled by Old Tom Distillery, Bardstown, Kentucky",
  countryOfOrigin: null,
};

const CORRECT_WARNING: ExtractedLabel["governmentWarning"] = {
  present: true,
  verbatimText: GOVERNMENT_WARNING_FULL,
  prefixAppearsBold: true,
};

const FIXTURES: Record<string, ExtractedLabel> = {
  "old-tom-correct": {
    ...OLD_TOM_BASE,
    governmentWarning: CORRECT_WARNING,
    legibility: "good",
    legibilityNotes: null,
  },
  "old-tom-abv-mismatch": {
    ...OLD_TOM_BASE,
    alcoholContent: "43% Alc./Vol. (86 Proof)",
    governmentWarning: CORRECT_WARNING,
    legibility: "good",
    legibilityNotes: null,
  },
  "old-tom-warning-titlecase": {
    ...OLD_TOM_BASE,
    governmentWarning: {
      present: true,
      verbatimText: GOVERNMENT_WARNING_FULL.replace(
        "GOVERNMENT WARNING:",
        "Government Warning:",
      ),
      prefixAppearsBold: true,
    },
    legibility: "good",
    legibilityNotes: null,
  },
  "old-tom-photo-angled": {
    ...OLD_TOM_BASE,
    governmentWarning: CORRECT_WARNING,
    legibility: "degraded",
    legibilityNotes: "Image is rotated and slightly blurred; text readable with effort.",
  },
  "stones-throw-case": {
    brandName: "STONE'S THROW",
    classType: "Straight Rye Whiskey",
    alcoholContent: "50% Alc./Vol. (100 Proof)",
    netContents: "750 mL",
    bottlerNameAddress: "Bottled by Stone's Throw Spirits Co., Portland, Oregon",
    countryOfOrigin: null,
    governmentWarning: CORRECT_WARNING,
    legibility: "good",
    legibilityNotes: null,
  },
  "high-desert-missing-warning": {
    brandName: "HIGH DESERT",
    classType: "Blended American Whiskey",
    alcoholContent: "40% Alc./Vol. (80 Proof)",
    netContents: "1 L",
    bottlerNameAddress: "Bottled by High Desert Beverage Co., Reno, Nevada",
    countryOfOrigin: null,
    governmentWarning: { present: false, verbatimText: null, prefixAppearsBold: null },
    legibility: "good",
    legibilityNotes: null,
  },
};

const DEFAULT_FIXTURE = FIXTURES["old-tom-correct"];

export function mockExtraction(fileName: string): ExtractedLabel {
  const stem = fileName.replace(/\.[^.]+$/, "").toLowerCase();
  return FIXTURES[stem] ?? DEFAULT_FIXTURE;
}
