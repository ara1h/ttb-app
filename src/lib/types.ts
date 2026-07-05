/**
 * Application data as entered by the compliance agent (or supplied via batch CSV).
 * All fields optional — empty fields are skipped rather than failed, so the tool
 * also works as a pure compliance scan (warning check only).
 */
export interface ApplicationData {
  brandName?: string;
  classType?: string;
  alcoholContent?: string; // e.g. "45", "45%", "45% Alc./Vol. (90 Proof)"
  netContents?: string; // e.g. "750 mL", "1 L", "12 fl oz"
}

/** Structured fields extracted from the label image by the vision model. */
export interface ExtractedLabel {
  brandName: string | null;
  classType: string | null;
  alcoholContent: string | null;
  netContents: string | null;
  bottlerNameAddress: string | null;
  countryOfOrigin: string | null;
  governmentWarning: {
    present: boolean;
    /** Verbatim transcription preserving capitalization and punctuation. */
    verbatimText: string | null;
    /** Best-effort visual judgment; null when the model can't tell. */
    prefixAppearsBold: boolean | null;
  };
  legibility: "good" | "degraded" | "unreadable";
  legibilityNotes: string | null;
}

export type FieldVerdict =
  | "match" // exact match
  | "close_match" // same value, trivial formatting difference (case/punctuation)
  | "review" // similar but a human should decide
  | "mismatch" // clearly different
  | "missing" // in the application but not found on the label
  | "skipped"; // no application value provided

export interface FieldResult {
  field: string;
  label: string; // human-readable field name
  verdict: FieldVerdict;
  applicationValue: string | null;
  labelValue: string | null;
  detail: string;
}

export type OverallVerdict = "pass" | "review" | "fail" | "unreadable";

export interface VerificationResult {
  overall: OverallVerdict;
  fields: FieldResult[];
  legibility: ExtractedLabel["legibility"];
  legibilityNotes: string | null;
}

/** Full API response for one label. */
export interface VerifyResponse {
  fileName: string;
  extracted: ExtractedLabel;
  result: VerificationResult;
  elapsedMs: number;
  mock: boolean;
}
