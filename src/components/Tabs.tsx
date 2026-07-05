"use client";

import { useState } from "react";
import SingleCheck from "./SingleCheck";
import BatchCheck from "./BatchCheck";

const TABS = [
  { id: "single", label: "Check one label" },
  { id: "batch", label: "Check a batch" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Tabs() {
  const [active, setActive] = useState<TabId>("single");

  return (
    <div>
      <div role="tablist" aria-label="Verification mode" className="mb-6 flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => setActive(tab.id)}
            className={`rounded-lg px-5 py-3 text-base font-bold transition focus:outline-none focus:ring-4 focus:ring-blue-300 ${
              active === tab.id
                ? "bg-blue-900 text-white shadow"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {active === "single" ? <SingleCheck /> : <BatchCheck />}
    </div>
  );
}
