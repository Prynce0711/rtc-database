"use client";

import { useState } from "react";
import JudgementMTC from "./JudgementMTC";
import JudgementRTC from "./JudgementRTC";

type JudgementView = "MTC" | "RTC";

const views: { label: string; value: JudgementView; description: string }[] = [
  { label: "MTC", value: "MTC", description: "Municipal Trial Court" },
  { label: "RTC", value: "RTC", description: "Regional Trial Court" },
];

export default function Judgement() {
  const [activeView, setActiveView] = useState<JudgementView>("MTC");

  return (
    <div className="space-y-6">
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
                  name="judgementView"
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
      {activeView === "MTC" && <JudgementMTC />}
      {activeView === "RTC" && <JudgementRTC />}
    </div>
  );
}
