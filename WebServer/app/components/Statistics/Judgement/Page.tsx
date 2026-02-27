"use client";

import Judgement from "./Judgement";

export default function JudgementPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-base-content">Judgment Day</h1>
        <p className="text-base-content/60 mt-2">
          View judgment day statistics and reports
        </p>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <Judgement />
        </div>
      </div>
    </div>
  );
}
