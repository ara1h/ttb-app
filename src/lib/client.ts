import type { ApplicationData, VerifyResponse } from "./types";

/**
 * Browser-side helpers: image downscaling before upload (keeps requests small
 * and extraction fast), the /api/verify call, and batch CSV handling.
 */

const MAX_DIMENSION = 1568; // Claude vision's optimal max edge
const JPEG_QUALITY = 0.85;

/** Downscale large images on the client so uploads stay fast and under limits. */
export async function prepareImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = MAX_DIMENSION / Math.max(bitmap.width, bitmap.height);
  const needsResize = scale < 1;
  const needsRecompress = file.size > 2 * 1024 * 1024;
  if (!needsResize && !needsRecompress) {
    bitmap.close();
    return file;
  }

  const width = Math.round(bitmap.width * Math.min(scale, 1));
  const height = Math.round(bitmap.height * Math.min(scale, 1));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) return file;

  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}

export async function verifyImage(
  file: File,
  application: ApplicationData,
): Promise<VerifyResponse> {
  const prepared = await prepareImage(file);
  const form = new FormData();
  form.append("image", prepared, prepared.name);
  form.append("application", JSON.stringify(application));

  const response = await fetch("/api/verify", { method: "POST", body: form });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error ?? `Verification failed (HTTP ${response.status}).`);
  }
  return body as VerifyResponse;
}

/** Run tasks with limited concurrency, reporting completion as results arrive. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
  onSettled?: (index: number, result: R | Error) => void,
): Promise<(R | Error)[]> {
  const results = new Array<R | Error>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = await task(items[index], index);
      } catch (error) {
        results[index] = error instanceof Error ? error : new Error(String(error));
      }
      onSettled?.(index, results[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

export const CSV_TEMPLATE_HEADER =
  "file_name,brand_name,class_type,alcohol_content,net_contents";

export const CSV_TEMPLATE = [
  CSV_TEMPLATE_HEADER,
  'old-tom-correct.png,OLD TOM DISTILLERY,Kentucky Straight Bourbon Whiskey,"45% Alc./Vol. (90 Proof)",750 mL',
].join("\n");

/** Minimal CSV parser with quoted-field support (commas and quotes in values). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        value += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(value);
      value = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      value = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else {
      value += ch;
    }
  }
  row.push(value);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

/** Parse the batch CSV into a map of file name → application data. */
export function parseApplicationCsv(text: string): {
  byFileName: Map<string, ApplicationData>;
  error?: string;
} {
  const rows = parseCsv(text);
  if (rows.length === 0) return { byFileName: new Map(), error: "The CSV file is empty." };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const fileCol = col("file_name");
  if (fileCol === -1) {
    return {
      byFileName: new Map(),
      error: 'The CSV must have a "file_name" column. Download the template for the expected format.',
    };
  }
  const cell = (row: string[], index: number) =>
    index >= 0 ? row[index]?.trim() || undefined : undefined;

  const byFileName = new Map<string, ApplicationData>();
  for (const row of rows.slice(1)) {
    const fileName = row[fileCol]?.trim();
    if (!fileName) continue;
    byFileName.set(fileName.toLowerCase(), {
      brandName: cell(row, col("brand_name")),
      classType: cell(row, col("class_type")),
      alcoholContent: cell(row, col("alcohol_content")),
      netContents: cell(row, col("net_contents")),
    });
  }
  return { byFileName };
}

function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serialize batch results for download. */
export function resultsToCsv(
  results: { fileName: string; response?: VerifyResponse; error?: string }[],
): string {
  const lines = [
    "file_name,overall,brand_name,class_type,alcohol_content,net_contents,government_warning,notes",
  ];
  for (const item of results) {
    if (!item.response) {
      lines.push(
        [csvEscape(item.fileName), "error", "", "", "", "", "", csvEscape(item.error ?? "Unknown error")].join(","),
      );
      continue;
    }
    const fields = item.response.result.fields;
    const verdict = (name: string) => fields.find((f) => f.field === name)?.verdict ?? "";
    const notes = fields
      .filter((f) => f.verdict !== "match" && f.verdict !== "skipped")
      .map((f) => `${f.label}: ${f.detail}`)
      .join(" | ");
    lines.push(
      [
        csvEscape(item.fileName),
        item.response.result.overall,
        verdict("brandName"),
        verdict("classType"),
        verdict("alcoholContent"),
        verdict("netContents"),
        verdict("governmentWarning"),
        csvEscape(notes),
      ].join(","),
    );
  }
  return lines.join("\n");
}
