import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedLabel } from "./types";
import { mockExtraction } from "./mock";

const MODEL = process.env.CLAUDE_MODEL ?? "claude-haiku-4-5";

export type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

const EXTRACTION_TOOL: Anthropic.Tool = {
  name: "record_label_fields",
  description: "Record the fields found on an alcohol beverage label.",
  input_schema: {
    type: "object" as const,
    properties: {
      brandName: { type: ["string", "null"], description: "Brand name, verbatim as printed." },
      classType: {
        type: ["string", "null"],
        description: 'Class/type designation, e.g. "Kentucky Straight Bourbon Whiskey".',
      },
      alcoholContent: {
        type: ["string", "null"],
        description: 'Alcohol content statement verbatim, e.g. "45% Alc./Vol. (90 Proof)".',
      },
      netContents: { type: ["string", "null"], description: 'Net contents verbatim, e.g. "750 mL".' },
      bottlerNameAddress: {
        type: ["string", "null"],
        description: "Name and address of the bottler/producer/importer, if shown.",
      },
      countryOfOrigin: { type: ["string", "null"], description: "Country of origin, if shown." },
      warningPresent: {
        type: "boolean",
        description: "Whether a government health warning statement appears on the label.",
      },
      warningVerbatimText: {
        type: ["string", "null"],
        description:
          "The COMPLETE warning statement transcribed EXACTLY as printed — preserve capitalization, punctuation, and numbering. Do not correct errors.",
      },
      warningPrefixAppearsBold: {
        type: ["boolean", "null"],
        description:
          'Whether the "GOVERNMENT WARNING" prefix appears visually bolder than the rest of the statement. null if impossible to judge.',
      },
      legibility: {
        type: "string",
        enum: ["good", "degraded", "unreadable"],
        description:
          "good = all text clearly readable; degraded = readable with effort (blur, angle, glare) — note issues; unreadable = cannot reliably read required fields.",
      },
      legibilityNotes: {
        type: ["string", "null"],
        description: "Short note on image-quality issues (blur, angle, glare, crop), if any.",
      },
    },
    required: ["warningPresent", "legibility"],
  },
};

const SYSTEM_PROMPT = `You are a document transcription assistant for TTB alcohol label review.
You will be shown a photograph or scan of an alcohol beverage label.
Transcribe the requested fields EXACTLY as printed — verbatim, preserving capitalization and punctuation.
Never paraphrase, normalize, or correct what the label says; compliance depends on exact wording.
If a field is not visible on the label, return null for it. Then call record_label_fields.`;

interface RawExtraction {
  brandName?: string | null;
  classType?: string | null;
  alcoholContent?: string | null;
  netContents?: string | null;
  bottlerNameAddress?: string | null;
  countryOfOrigin?: string | null;
  warningPresent?: boolean;
  warningVerbatimText?: string | null;
  warningPrefixAppearsBold?: boolean | null;
  legibility?: string;
  legibilityNotes?: string | null;
}

function toExtractedLabel(raw: RawExtraction): ExtractedLabel {
  const legibility =
    raw.legibility === "degraded" || raw.legibility === "unreadable"
      ? raw.legibility
      : "good";
  return {
    brandName: raw.brandName ?? null,
    classType: raw.classType ?? null,
    alcoholContent: raw.alcoholContent ?? null,
    netContents: raw.netContents ?? null,
    bottlerNameAddress: raw.bottlerNameAddress ?? null,
    countryOfOrigin: raw.countryOfOrigin ?? null,
    governmentWarning: {
      present: raw.warningPresent ?? false,
      verbatimText: raw.warningVerbatimText ?? null,
      prefixAppearsBold: raw.warningPrefixAppearsBold ?? null,
    },
    legibility,
    legibilityNotes: raw.legibilityNotes ?? null,
  };
}

export function isMockMode(): boolean {
  return !process.env.ANTHROPIC_API_KEY;
}

/**
 * Extract structured fields from a label image using Claude vision.
 * Falls back to canned fixtures (keyed by file name) when no API key is set,
 * so the app can be demoed offline — responses are flagged `mock` in the UI.
 */
export async function extractLabel(
  imageBase64: string,
  mediaType: ImageMediaType,
  fileName: string,
): Promise<ExtractedLabel> {
  if (isMockMode()) {
    return mockExtraction(fileName);
  }

  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: "record_label_fields" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          { type: "text", text: "Transcribe this alcohol beverage label." },
        ],
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("The vision model did not return structured label fields.");
  }
  return toExtractedLabel(toolUse.input as RawExtraction);
}
