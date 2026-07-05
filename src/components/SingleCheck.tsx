"use client";

import { useRef, useState } from "react";
import { verifyImage } from "@/lib/client";
import { SAMPLE_SCENARIOS } from "@/lib/samples";
import type { ApplicationData, VerifyResponse } from "@/lib/types";
import ResultPanel from "./ResultPanel";

const EMPTY_FORM: Required<ApplicationData> = {
  brandName: "",
  classType: "",
  alcoholContent: "",
  netContents: "",
};

const FIELDS: { key: keyof ApplicationData; label: string; placeholder: string }[] = [
  { key: "brandName", label: "Brand name", placeholder: "e.g. OLD TOM DISTILLERY" },
  { key: "classType", label: "Class / type", placeholder: "e.g. Kentucky Straight Bourbon Whiskey" },
  { key: "alcoholContent", label: "Alcohol content", placeholder: "e.g. 45% Alc./Vol. (90 Proof)" },
  { key: "netContents", label: "Net contents", placeholder: "e.g. 750 mL" },
];

export default function SingleCheck() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<VerifyResponse | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function selectFile(selected: File | null) {
    setResponse(null);
    setError(null);
    setFile(selected);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return selected ? URL.createObjectURL(selected) : null;
    });
  }

  async function loadSample(id: string) {
    const sample = SAMPLE_SCENARIOS.find((s) => s.id === id);
    if (!sample) return;
    setError(null);
    setForm({ ...EMPTY_FORM, ...sample.application });
    try {
      const blob = await fetch(`/samples/${sample.file}`).then((r) => {
        if (!r.ok) throw new Error();
        return r.blob();
      });
      selectFile(new File([blob], sample.file, { type: "image/png" }));
    } catch {
      setError("Could not load the sample image.");
    }
  }

  async function handleVerify() {
    if (!file) {
      setError("Please add a label image first.");
      return;
    }
    setBusy(true);
    setError(null);
    setResponse(null);
    try {
      setResponse(await verifyImage(file, form));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-6">
        <section>
          <h2 className="mb-1 text-lg font-bold text-gray-900">
            <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-900 text-sm text-white">1</span>
            Application details
          </h2>
          <p className="mb-3 text-sm text-gray-600">
            Type what the application says. Leave a field blank to skip that check — the
            government warning is always checked.
          </p>
          <div className="space-y-3">
            {FIELDS.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label htmlFor={key} className="mb-1 block text-sm font-semibold text-gray-800">
                  {label}
                </label>
                <input
                  id={key}
                  type="text"
                  value={form[key]}
                  placeholder={placeholder}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-bold text-gray-900">
            <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-900 text-sm text-white">2</span>
            Label image
          </h2>
          <div
            role="button"
            tabIndex={0}
            aria-label="Add a label image"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              selectFile(e.dataTransfer.files[0] ?? null);
            }}
            className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition ${
              dragOver ? "border-blue-700 bg-blue-50" : "border-gray-300 bg-white hover:border-blue-500"
            }`}
          >
            {previewUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Selected label" className="max-h-56 rounded shadow-sm" />
                <p className="mt-2 text-sm text-gray-600">{file?.name} — click to change</p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-gray-700">
                  Click to choose a label image
                </p>
                <p className="mt-1 text-sm text-gray-500">or drag and drop it here (JPEG or PNG)</p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
          />
        </section>

        <button
          type="button"
          onClick={handleVerify}
          disabled={busy}
          className="w-full rounded-lg bg-blue-900 px-6 py-4 text-lg font-bold text-white shadow transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {busy ? "Checking label…" : "Check this label"}
        </button>

        <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="mb-2 text-sm font-semibold text-gray-700">
            No label handy? Try an example:
          </p>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_SCENARIOS.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => loadSample(sample.id)}
                title={sample.description}
                className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 transition hover:border-blue-600 hover:text-blue-800"
              >
                {sample.title}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div aria-live="polite">
        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-base text-red-800">
            {error}
          </div>
        )}
        {busy && (
          <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-800" />
            <p className="mt-3 text-base">Reading the label…</p>
          </div>
        )}
        {response && <ResultPanel response={response} />}
        {!response && !busy && !error && (
          <div className="flex min-h-48 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 p-8 text-center text-gray-400">
            <p className="text-base">
              Results will appear here after you check a label.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
