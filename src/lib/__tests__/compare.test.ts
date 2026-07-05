import { describe, expect, it } from "vitest";
import {
  overallVerdict,
  parseAlcoholContent,
  parseNetContents,
  verifyLabel,
} from "../compare";
import type { ApplicationData, ExtractedLabel } from "../types";
import { GOVERNMENT_WARNING_FULL } from "../warning";

const CORRECT_WARNING: ExtractedLabel["governmentWarning"] = {
  present: true,
  verbatimText: GOVERNMENT_WARNING_FULL,
  prefixAppearsBold: true,
};

function label(overrides: Partial<ExtractedLabel> = {}): ExtractedLabel {
  return {
    brandName: "OLD TOM DISTILLERY",
    classType: "Kentucky Straight Bourbon Whiskey",
    alcoholContent: "45% Alc./Vol. (90 Proof)",
    netContents: "750 mL",
    bottlerNameAddress: null,
    countryOfOrigin: null,
    governmentWarning: CORRECT_WARNING,
    legibility: "good",
    legibilityNotes: null,
    ...overrides,
  };
}

const APPLICATION: ApplicationData = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
};

function fieldVerdict(result: ReturnType<typeof verifyLabel>, field: string) {
  return result.fields.find((f) => f.field === field)?.verdict;
}

describe("verifyLabel", () => {
  it("passes a fully matching label", () => {
    const result = verifyLabel(APPLICATION, label());
    expect(result.overall).toBe("pass");
    expect(result.fields.every((f) => f.verdict === "match")).toBe(true);
  });

  it("treats case/punctuation-only brand differences as a close match, not a failure", () => {
    // Dave's example: STONE'S THROW on the label, Stone's Throw in the application.
    const result = verifyLabel(
      { brandName: "Stone's Throw" },
      label({ brandName: "STONE'S THROW" }),
    );
    expect(fieldVerdict(result, "brandName")).toBe("close_match");
    expect(result.overall).toBe("pass");
  });

  it("handles curly apostrophes in brand names", () => {
    const result = verifyLabel(
      { brandName: "Stone's Throw" },
      label({ brandName: "STONE’S THROW" }),
    );
    expect(fieldVerdict(result, "brandName")).toBe("close_match");
  });

  it("flags similar-but-different brand names for review", () => {
    const result = verifyLabel(
      { brandName: "OLD TOM DISTILLERY" },
      label({ brandName: "OLD TOM DISTILLERS" }),
    );
    expect(fieldVerdict(result, "brandName")).toBe("review");
    expect(result.overall).toBe("review");
  });

  it("fails clearly different brand names", () => {
    const result = verifyLabel(
      { brandName: "OLD TOM DISTILLERY" },
      label({ brandName: "HIGH DESERT" }),
    );
    expect(fieldVerdict(result, "brandName")).toBe("mismatch");
    expect(result.overall).toBe("fail");
  });

  it("skips fields with no application value", () => {
    const result = verifyLabel({}, label());
    expect(fieldVerdict(result, "brandName")).toBe("skipped");
    // Warning is always checked regardless of application data.
    expect(fieldVerdict(result, "governmentWarning")).toBe("match");
    expect(result.overall).toBe("pass");
  });

  it("reports a field present in the application but missing from the label", () => {
    const result = verifyLabel(APPLICATION, label({ netContents: null }));
    expect(fieldVerdict(result, "netContents")).toBe("missing");
    expect(result.overall).toBe("fail");
  });

  it("marks the whole label unreadable when legibility is unreadable", () => {
    const result = verifyLabel(APPLICATION, label({ legibility: "unreadable" }));
    expect(result.overall).toBe("unreadable");
  });
});

describe("alcohol content", () => {
  it("parses percent, proof, and bare numbers", () => {
    expect(parseAlcoholContent("45% Alc./Vol. (90 Proof)")).toEqual({ abv: 45, proof: 90 });
    expect(parseAlcoholContent("45")).toEqual({ abv: 45, proof: null });
    expect(parseAlcoholContent("90 proof")).toEqual({ abv: 45, proof: 90 });
    expect(parseAlcoholContent("13.5% alc/vol")).toEqual({ abv: 13.5, proof: null });
  });

  it("matches equivalent formats", () => {
    const result = verifyLabel(
      { alcoholContent: "45" },
      label({ alcoholContent: "45% ALC./VOL." }),
    );
    expect(fieldVerdict(result, "alcoholContent")).toBe("match");
  });

  it("fails on a different ABV", () => {
    const result = verifyLabel(
      { alcoholContent: "45%" },
      label({ alcoholContent: "43% Alc./Vol. (86 Proof)" }),
    );
    expect(fieldVerdict(result, "alcoholContent")).toBe("mismatch");
    expect(result.overall).toBe("fail");
  });

  it("flags proof inconsistent with ABV for review", () => {
    const result = verifyLabel(
      { alcoholContent: "45%" },
      label({ alcoholContent: "45% Alc./Vol. (86 Proof)" }),
    );
    expect(fieldVerdict(result, "alcoholContent")).toBe("review");
  });
});

describe("net contents", () => {
  it("parses common formats to milliliters", () => {
    expect(parseNetContents("750 mL")).toBe(750);
    expect(parseNetContents("750ML")).toBe(750);
    expect(parseNetContents("1 L")).toBe(1000);
    expect(parseNetContents("75 cl")).toBe(750);
    expect(parseNetContents("12 fl. oz.")).toBeCloseTo(354.88, 1);
    expect(parseNetContents("no volume here")).toBeNull();
  });

  it("matches across equivalent units", () => {
    const result = verifyLabel(
      { netContents: "750 mL" },
      label({ netContents: "75 cl" }),
    );
    expect(fieldVerdict(result, "netContents")).toBe("match");
  });

  it("fails on different volumes", () => {
    const result = verifyLabel(
      { netContents: "750 mL" },
      label({ netContents: "1 L" }),
    );
    expect(fieldVerdict(result, "netContents")).toBe("mismatch");
  });
});

describe("government warning", () => {
  it("passes the exact statutory text", () => {
    const result = verifyLabel({}, label());
    expect(fieldVerdict(result, "governmentWarning")).toBe("match");
  });

  it("fails when the warning is missing", () => {
    const result = verifyLabel(
      {},
      label({ governmentWarning: { present: false, verbatimText: null, prefixAppearsBold: null } }),
    );
    expect(fieldVerdict(result, "governmentWarning")).toBe("missing");
    expect(result.overall).toBe("fail");
  });

  it("fails a title-case prefix (Jenny's rejection case)", () => {
    const result = verifyLabel(
      {},
      label({
        governmentWarning: {
          present: true,
          verbatimText: GOVERNMENT_WARNING_FULL.replace("GOVERNMENT WARNING:", "Government Warning:"),
          prefixAppearsBold: true,
        },
      }),
    );
    expect(fieldVerdict(result, "governmentWarning")).toBe("mismatch");
    expect(result.overall).toBe("fail");
  });

  it("routes punctuation-only deviations to review (image-quality noise)", () => {
    // A blurry photo can make the model read "defects." as "defects;".
    const variant = GOVERNMENT_WARNING_FULL.replace("birth defects.", "birth defects;");
    const result = verifyLabel(
      {},
      label({
        governmentWarning: { present: true, verbatimText: variant, prefixAppearsBold: true },
      }),
    );
    const field = result.fields.find((f) => f.field === "governmentWarning");
    expect(field?.verdict).toBe("review");
    expect(result.overall).toBe("review");
  });

  it("fails reworded text and reports the deviation", () => {
    const reworded = GOVERNMENT_WARNING_FULL.replace("birth defects", "health issues");
    const result = verifyLabel(
      {},
      label({
        governmentWarning: { present: true, verbatimText: reworded, prefixAppearsBold: true },
      }),
    );
    const field = result.fields.find((f) => f.field === "governmentWarning");
    expect(field?.verdict).toBe("mismatch");
    expect(field?.detail).toContain("birth defects");
  });

  it("tolerates whitespace and curly-quote variants", () => {
    const variant = GOVERNMENT_WARNING_FULL.replace(/ /g, "  ").replace(
      "women",
      "women",
    );
    const result = verifyLabel(
      {},
      label({
        governmentWarning: { present: true, verbatimText: variant, prefixAppearsBold: true },
      }),
    );
    expect(fieldVerdict(result, "governmentWarning")).toBe("match");
  });

  it("asks for review when the prefix may not be bold", () => {
    const result = verifyLabel(
      {},
      label({
        governmentWarning: {
          present: true,
          verbatimText: GOVERNMENT_WARNING_FULL,
          prefixAppearsBold: false,
        },
      }),
    );
    expect(fieldVerdict(result, "governmentWarning")).toBe("review");
  });
});

describe("overallVerdict", () => {
  it("prioritizes fail over review", () => {
    const result = verifyLabel(
      { brandName: "HIGH DESERT", alcoholContent: "45%" },
      label({ alcoholContent: "45% (86 proof)" }),
    );
    expect(overallVerdict(result.fields, "good")).toBe("fail");
  });
});
