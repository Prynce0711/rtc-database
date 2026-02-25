"use client";

import { useState } from "react";
import Inventory from "./Inventory";
import MTC from "./MTC";
import RTC from "./RTC";

type AnnualView = "MTC" | "RTC" | "Inventory";

const views: { label: string; value: AnnualView; description: string }[] = [
  {
    label: "MTC",
    value: "MTC",
    description: "Municipal Trial Court",
  },
  {
    label: "RTC",
    value: "RTC",
    description: "Regional Trial Court",
  },
  {
    label: "Inventory",
    value: "Inventory",
    description: "Court Document Inventory",
  },
];

export default function AnnualPage() {
  const [activeView, setActiveView] = useState<AnnualView>("MTC");

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-4xl font-bold text-base-content">Annual Reports</h1>
        <p className="text-base-content/60 mt-2">
          View annual statistics and reports
        </p>
      </div>

      {/* View selector */}
      <div className="card bg-base-100 shadow border border-base-200">
        <div className="card-body py-4">
          <div className="flex flex-wrap gap-6">
            {views.map(({ label, value, description }) => (
              <label
                key={value}
                className="flex items-center gap-3 cursor-pointer select-none group"
              >
                <input
                  type="radio"
                  name="annualView"
                  className="radio radio-primary"
                  value={value}
                  checked={activeView === value}
                  onChange={() => setActiveView(value)}
                />
                <div>
                  <span
                    className={`font-semibold ${activeView === value ? "text-primary" : "text-base-content"}`}
                  >
                    {label}
                  </span>
                  <p className="text-xs text-base-content/50">{description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Active table */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          {activeView === "MTC" && <MTC />}
          {activeView === "RTC" && <RTC />}
          {activeView === "Inventory" && <Inventory />}
        </div>
      </div>
    </div>
  );
}
