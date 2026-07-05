import { isMockMode } from "@/lib/extract";
import Tabs from "@/components/Tabs";

export default function Home() {
  const mock = isMockMode();

  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      <header className="bg-blue-950 text-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-300">
            TTB Prototype — not an official system
          </p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Label Check</h1>
          <p className="mt-1 max-w-3xl text-sm text-blue-100 sm:text-base">
            Upload a label image and the application details. The AI reads the label,
            checks every field, and verifies the government warning — in seconds. You
            always make the final call.
          </p>
        </div>
      </header>

      {mock && (
        <div className="border-b border-amber-300 bg-amber-50 px-6 py-2 text-center text-sm font-medium text-amber-900">
          Demo mode: no AI key is configured, so the bundled sample labels return canned
          results. Set <code className="rounded bg-amber-100 px-1">ANTHROPIC_API_KEY</code> to
          analyze real images.
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <Tabs />
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 pb-8 text-sm text-gray-500">
        <p>
          Uploaded images are analyzed in memory and never stored. AI results are
          decision support for compliance agents, not final determinations.
        </p>
      </footer>
    </div>
  );
}
