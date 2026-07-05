import { cleaned, collapseWhitespace, wordDiff } from "./normalize";
import type { ExtractedLabel, FieldResult } from "./types";

/**
 * The mandatory health warning statement, verbatim, per 27 CFR Part 16
 * (Alcoholic Beverage Labeling Act). The "GOVERNMENT WARNING" prefix must
 * appear in capital letters and in bold; the body wording is fixed.
 */
export const GOVERNMENT_WARNING_PREFIX = "GOVERNMENT WARNING:";

export const GOVERNMENT_WARNING_BODY =
  "(1) According to the Surgeon General, women should not drink alcoholic " +
  "beverages during pregnancy because of the risk of birth defects. " +
  "(2) Consumption of alcoholic beverages impairs your ability to drive a car " +
  "or operate machinery, and may cause health problems.";

export const GOVERNMENT_WARNING_FULL = `${GOVERNMENT_WARNING_PREFIX} ${GOVERNMENT_WARNING_BODY}`;

const FIELD_META = { field: "governmentWarning", label: "Government Warning" };

/**
 * Word-for-word check of the government warning statement.
 *
 * Rules (per Jenny's walkthrough and 27 CFR 16.21):
 * - Statement must be present → otherwise FAIL.
 * - "GOVERNMENT WARNING:" must be in all caps, exactly → otherwise FAIL
 *   (title case is a real-world rejection case).
 * - Body must match word for word (case-insensitive for the body; whitespace
 *   and curly-quote variants tolerated) → any deviation is FAIL, with a diff.
 * - Bold prefix is judged visually by the model and is best-effort:
 *   "appears not bold" → REVIEW (human confirms); "can't tell" → noted only.
 */
export function checkGovernmentWarning(
  warning: ExtractedLabel["governmentWarning"],
): FieldResult {
  if (!warning.present || !warning.verbatimText) {
    return {
      ...FIELD_META,
      verdict: "missing",
      applicationValue: GOVERNMENT_WARNING_FULL,
      labelValue: null,
      detail:
        "No Government Warning statement was found on the label. It is mandatory on all alcohol beverage labels.",
    };
  }

  const found = cleaned(warning.verbatimText);

  // Prefix: must be exactly "GOVERNMENT WARNING:" in capital letters.
  const prefixPattern = /^government\s+warning\s*:?/i;
  const prefixMatch = found.match(prefixPattern);
  if (!prefixMatch) {
    return {
      ...FIELD_META,
      verdict: "mismatch",
      applicationValue: GOVERNMENT_WARNING_FULL,
      labelValue: warning.verbatimText,
      detail:
        'The statement does not begin with "GOVERNMENT WARNING:". The exact prefix is required.',
    };
  }
  const foundPrefix = collapseWhitespace(prefixMatch[0]);
  if (foundPrefix !== GOVERNMENT_WARNING_PREFIX) {
    return {
      ...FIELD_META,
      verdict: "mismatch",
      applicationValue: GOVERNMENT_WARNING_FULL,
      labelValue: warning.verbatimText,
      detail: `The prefix must read "GOVERNMENT WARNING:" in all capital letters. Found: "${foundPrefix}".`,
    };
  }

  // Body: word-for-word (case-insensitive), tolerant of whitespace only.
  const expectedWords = GOVERNMENT_WARNING_BODY.toLowerCase().split(" ");
  const foundBody = collapseWhitespace(found.slice(foundPrefix.length));
  const foundWords = foundBody.toLowerCase().split(" ").filter(Boolean);

  if (expectedWords.join(" ") !== foundWords.join(" ")) {
    const diff = wordDiff(expectedWords, foundWords);
    const parts: string[] = [];
    if (diff.expected.length > 0) {
      parts.push(`required wording not found: "${diff.expected.join(" ")}"`);
    }
    if (diff.found.length > 0) {
      parts.push(`unexpected wording on label: "${diff.found.join(" ")}"`);
    }
    // Punctuation-only deviations ("defects;" vs "defects.") are as likely to
    // be transcription noise from an imperfect photo as a real label defect —
    // route them to a human instead of hard-failing.
    const strip = (w: string) => w.replace(/[^a-z0-9]/g, "");
    const punctuationOnly =
      expectedWords.map(strip).join(" ") === foundWords.map(strip).join(" ");
    if (punctuationOnly) {
      return {
        ...FIELD_META,
        verdict: "review",
        applicationValue: GOVERNMENT_WARNING_FULL,
        labelValue: warning.verbatimText,
        detail: `The wording matches, but punctuation appears to differ — ${parts.join("; ")}. This may be an artifact of image quality; please verify against the label.`,
      };
    }
    return {
      ...FIELD_META,
      verdict: "mismatch",
      applicationValue: GOVERNMENT_WARNING_FULL,
      labelValue: warning.verbatimText,
      detail: `The warning text deviates from the required statement — ${parts.join("; ")}. The wording must match word for word.`,
    };
  }

  // Text is exact. Bold is a visual judgment — flag rather than fail.
  if (warning.prefixAppearsBold === false) {
    return {
      ...FIELD_META,
      verdict: "review",
      applicationValue: GOVERNMENT_WARNING_FULL,
      labelValue: warning.verbatimText,
      detail:
        'Warning text is word-for-word correct, but the "GOVERNMENT WARNING:" prefix may not be in bold type. Please verify visually.',
    };
  }

  return {
    ...FIELD_META,
    verdict: "match",
    applicationValue: GOVERNMENT_WARNING_FULL,
    labelValue: warning.verbatimText,
    detail:
      warning.prefixAppearsBold === null
        ? "Warning statement matches word for word with the required all-caps prefix. (Bold type could not be assessed from the image.)"
        : "Warning statement matches word for word, with the required all-caps, bold prefix.",
  };
}
