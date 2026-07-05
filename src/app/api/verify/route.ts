import { NextRequest, NextResponse } from "next/server";
import { verifyLabel } from "@/lib/compare";
import { extractLabel, isMockMode, type ImageMediaType } from "@/lib/extract";
import type { ApplicationData, VerifyResponse } from "@/lib/types";

export const runtime = "nodejs";
// Allow headroom over the ~5s target for cold starts and large images.
export const maxDuration = 30;

const ALLOWED_TYPES: ImageMediaType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

// Vercel's request body limit is 4.5 MB; the client also downscales images.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const started = Date.now();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest("Expected multipart form data with an image file.");
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return badRequest("No image file provided.");
  }
  const mediaType = file.type as ImageMediaType;
  if (!ALLOWED_TYPES.includes(mediaType)) {
    return badRequest(
      `Unsupported image type "${file.type || "unknown"}". Please upload a JPEG, PNG, WebP, or GIF.`,
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return badRequest(
      `Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 4 MB.`,
    );
  }

  let application: ApplicationData = {};
  const rawApplication = form.get("application");
  if (typeof rawApplication === "string" && rawApplication.trim()) {
    try {
      application = JSON.parse(rawApplication) as ApplicationData;
    } catch {
      return badRequest("Application data is not valid JSON.");
    }
  }

  const imageBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  try {
    const extracted = await extractLabel(imageBase64, mediaType, file.name);
    const result = verifyLabel(application, extracted);
    const response: VerifyResponse = {
      fileName: file.name,
      extracted,
      result,
      elapsedMs: Date.now() - started,
      mock: isMockMode(),
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Label verification failed:", error);
    return NextResponse.json(
      {
        error:
          "The label could not be analyzed. Please try again, or verify this label manually.",
      },
      { status: 502 },
    );
  }
}
