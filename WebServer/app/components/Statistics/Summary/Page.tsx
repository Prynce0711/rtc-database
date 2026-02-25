"use client";

import React from "react";

export default function SummaryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-base-content">Summary</h1>
        <p className="text-base-content/60 mt-2">
          View summary statistics and reports
        </p>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Summary Statistics</h2>
          <p>Summary content will be displayed here.</p>
        </div>
      </div>
    </div>
  );
}
