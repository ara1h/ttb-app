"use client";

import { useRef, useState } from "react";
import {
  CSV_TEMPLATE,
  mapWithConcurrency,
  parseApplicationCsv,
  resultsToCsv,
  verifyImage,
} from "@/lib/client";
import type { ApplicationData, VerifyResponse } from "@/lib/types";
import ResultPanel, { OverallBadge } from "./ResultPanel";

const CONCURRENCY = 4;

interface BatchItem {
  file: File;
  status: "queued" | "running" | "done" | "error";
  response?: VerifyResponse;
  error?: string;
}

function download(fileName: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function BatchCheck() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [applications, setApplications] = useState<Map<string, ApplicationData>>(new Map());
  const [csvName, setCsvName] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const fresh = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((file): BatchItem => ({ file, status: "queued" }));
    setItems((old) => [...old, ...fresh]);
    setExpanded(null);
  }

  async function loadCsv(file: File | undefined) {
    if (!file) return;
    const { byFileName, error } = parseApplicationCsv(await file.text());
    setCsvError(error ?? null);
    setCsvName(error ? null : `${file.name} — details for ${byFileName.size} file(s)`);
    if (!error) setApplications(byFileName);
  }

  function applicationFor(file: File): ApplicationData {
    return applications.get(file.name.toLowerCase()) ?? {};
  }

  async function runBatch() {
    setBusy(true);
    setExpanded(null);
    setItems((old) =>
      old.map((item) => ({ file: item.file, status: "queued" as const })),
    );
    const files = items.map((i) => i.file);
    await mapWithConcurrency(
      files,
      CONCURRENCY,
      async (file, index) => {
        setItems((old) =>
          old.map((item, i) => (i === index ? { ...item, status: "running" } : item)),
        );
        return verifyImage(file, applicationFor(file));
      },
      (index, result) => {
        setItems((old) =>
          old.map((item, i) => {
            if (i !== index) return item;
            return result instanceof Error
              ? { ...item, status: "error", error: result.message }
              : { ...item, status: "done", response: result };
          }),
        );
      },
    );
    setBusy(false);
  }

  const doneCount = items.filter((i) => i.status === "done" || i.status === "error").length;
  const counts = {
    pass: items.filter((i) => i.response?.result.overall === "pass").length,
    review: items.filter((i) => i.response?.result.overall === "review").length,
    fail: items.filter((i) => i.response?.result.overall === "fail").length,
    other: items.filter(
      (i) => i.status === "error" || i.response?.result.overall === "unreadable",
    ).length,
  };
  const finished = !busy && items.length > 0 && doneCount === items.length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-1 text-lg font-bold text-gray-900">
            <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-900 text-sm text-white">1</span>
            Add label images
          </h2>
          <div
            role="button"
            tabIndex={0}
            aria-label="Add label images"
            onClick={() => imageInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && imageInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-5 text-center transition hover:border-blue-500"
          >
            <p className="text-base font-semibold text-gray-700">
              Click to choose images — as many as you need
            </p>
            <p className="mt-1 text-sm text-gray-500">or drag and drop them here</p>
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        <div>
          <h2 className="mb-1 text-lg font-bold text-gray-900">
            <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-900 text-sm text-white">2</span>
            Application details (optional)
          </h2>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-600">
              Upload a CSV listing each image&apos;s application details (matched by file
              name). Without it, labels are still scanned for the government warning.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => csvInputRef.current?.click()}
                className="rounded-md border border-blue-900 px-4 py-2 text-sm font-semibold text-blue-900 transition hover:bg-blue-50"
              >
                Upload CSV
              </button>
              <button
                type="button"
                onClick={() => download("label-batch-template.csv", CSV_TEMPLATE, "text/csv")}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Download template
              </button>
            </div>
            {csvName && <p className="mt-2 text-sm font-medium text-green-700">✓ {csvName}</p>}
            {csvError && <p className="mt-2 text-sm text-red-700">{csvError}</p>}
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                loadCsv(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </section>

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={runBatch}
            disabled={busy}
            className="rounded-lg bg-blue-900 px-6 py-3 text-lg font-bold text-white shadow transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {busy
              ? `Checking… ${doneCount} of ${items.length}`
              : `Check ${items.length} label${items.length === 1 ? "" : "s"}`}
          </button>
          {!busy && (
            <button
              type="button"
              onClick={() => {
                setItems([]);
                setExpanded(null);
              }}
              className="rounded-lg border border-gray-300 px-4 py-3 text-base font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Clear list
            </button>
          )}
          {finished && (
            <button
              type="button"
              onClick={() =>
                download(
                  "label-batch-results.csv",
                  resultsToCsv(
                    items.map((i) => ({
                      fileName: i.file.name,
                      response: i.response,
                      error: i.error,
                    })),
                  ),
                  "text/csv",
                )
              }
              className="rounded-lg border border-blue-900 px-4 py-3 text-base font-semibold text-blue-900 transition hover:bg-blue-50"
            >
              Download results (CSV)
            </button>
          )}
        </div>
      )}

      {busy && (
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200" aria-hidden>
          <div
            className="h-full rounded-full bg-blue-700 transition-all"
            style={{ width: `${(doneCount / Math.max(items.length, 1)) * 100}%` }}
          />
        </div>
      )}

      {finished && (
        <p className="text-base font-semibold text-gray-800" aria-live="polite">
          Done: <span className="text-green-700">{counts.pass} passed</span>
          {" · "}
          <span className="text-amber-600">{counts.review} need review</span>
          {" · "}
          <span className="text-red-700">{counts.fail} with issues</span>
          {counts.other > 0 && (
            <>
              {" · "}
              <span className="text-gray-600">{counts.other} unreadable / errors</span>
            </>
          )}
        </p>
      )}

      {items.length > 0 && (
        <ul className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-300 bg-white">
          {items.map((item, index) => (
            <li key={`${item.file.name}-${index}`}>
              <button
                type="button"
                disabled={!item.response}
                onClick={() => setExpanded(expanded === index ? null : index)}
                className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left transition enabled:hover:bg-gray-50"
              >
                <span className="text-base font-medium text-gray-900">{item.file.name}</span>
                <span className="flex items-center gap-2 text-sm">
                  {item.status === "queued" && <span className="text-gray-500">Waiting…</span>}
                  {item.status === "running" && (
                    <span className="flex items-center gap-2 text-blue-800">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-800" />
                      Checking…
                    </span>
                  )}
                  {item.status === "error" && (
                    <span className="font-semibold text-red-700">Error: {item.error}</span>
                  )}
                  {item.response && (
                    <>
                      <OverallBadge overall={item.response.result.overall} />
                      <span className="text-gray-500">
                        {(item.response.elapsedMs / 1000).toFixed(1)}s — click for details
                      </span>
                    </>
                  )}
                </span>
              </button>
              {expanded === index && item.response && (
                <div className="border-t border-gray-200 bg-gray-50 p-4">
                  <ResultPanel response={item.response} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
