import type { FieldVerdict, OverallVerdict, VerifyResponse } from "@/lib/types";

const VERDICT_STYLE: Record<
  FieldVerdict,
  { icon: string; text: string; className: string }
> = {
  match: { icon: "✓", text: "Match", className: "bg-green-100 text-green-800" },
  close_match: { icon: "✓", text: "Match (formatting differs)", className: "bg-green-100 text-green-800" },
  review: { icon: "!", text: "Needs review", className: "bg-amber-100 text-amber-900" },
  mismatch: { icon: "✕", text: "Mismatch", className: "bg-red-100 text-red-800" },
  missing: { icon: "✕", text: "Not on label", className: "bg-red-100 text-red-800" },
  skipped: { icon: "–", text: "Not checked", className: "bg-gray-100 text-gray-600" },
};

const OVERALL_STYLE: Record<
  OverallVerdict,
  { title: string; subtitle: string; className: string }
> = {
  pass: {
    title: "✓ All checks passed",
    subtitle: "Label matches the application and the warning statement is correct.",
    className: "bg-green-700 text-white",
  },
  review: {
    title: "! Needs your review",
    subtitle: "Some checks could not be decided automatically — see the flagged rows below.",
    className: "bg-amber-500 text-white",
  },
  fail: {
    title: "✕ Issues found",
    subtitle: "One or more checks failed — see the flagged rows below.",
    className: "bg-red-700 text-white",
  },
  unreadable: {
    title: "Image not readable",
    subtitle: "The label could not be read reliably. Request a clearer photo from the applicant.",
    className: "bg-gray-600 text-white",
  },
};

export function OverallBadge({ overall }: { overall: OverallVerdict }) {
  const style = OVERALL_STYLE[overall];
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-sm font-semibold ${style.className}`}>
      {style.title}
    </span>
  );
}

export default function ResultPanel({ response }: { response: VerifyResponse }) {
  const { result, extracted, elapsedMs } = response;
  const overall = OVERALL_STYLE[result.overall];

  return (
    <div className="overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm">
      <div className={`flex flex-wrap items-center justify-between gap-2 px-5 py-4 ${overall.className}`}>
        <div>
          <p className="text-xl font-bold">{overall.title}</p>
          <p className="text-sm opacity-90">{overall.subtitle}</p>
        </div>
        <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-medium">
          Checked in {(elapsedMs / 1000).toFixed(1)}s
        </span>
      </div>

      {result.legibility === "degraded" && (
        <p className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-sm text-amber-900">
          Image quality note: {result.legibilityNotes ?? "the photo is imperfect but readable."}
        </p>
      )}

      <ul className="divide-y divide-gray-200">
        {result.fields.map((field) => {
          const style = VERDICT_STYLE[field.verdict];
          return (
            <li key={field.field} className="px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-base font-semibold text-gray-900">{field.label}</p>
                <span className={`rounded-full px-3 py-0.5 text-sm font-semibold ${style.className}`}>
                  {style.icon} {style.text}
                </span>
              </div>
              {(field.applicationValue || field.labelValue) && (
                <div className="mt-1 grid gap-x-6 gap-y-0.5 text-sm text-gray-700 sm:grid-cols-2">
                  <p>
                    <span className="font-medium text-gray-500">Application: </span>
                    {field.applicationValue ?? "—"}
                  </p>
                  <p>
                    <span className="font-medium text-gray-500">On label: </span>
                    {field.labelValue ?? "—"}
                  </p>
                </div>
              )}
              {field.verdict !== "match" && (
                <p className="mt-1 text-sm text-gray-600">{field.detail}</p>
              )}
            </li>
          );
        })}
      </ul>

      {(extracted.bottlerNameAddress || extracted.countryOfOrigin) && (
        <div className="border-t border-gray-200 bg-gray-50 px-5 py-3 text-sm text-gray-700">
          <p className="font-semibold text-gray-900">Also found on the label</p>
          {extracted.bottlerNameAddress && <p>Bottler: {extracted.bottlerNameAddress}</p>}
          {extracted.countryOfOrigin && <p>Country of origin: {extracted.countryOfOrigin}</p>}
        </div>
      )}
    </div>
  );
}
