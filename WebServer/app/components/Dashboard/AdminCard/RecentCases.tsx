import React from "react";
import type { Case } from "../../../generated/prisma/client";

interface Props {
  cases: Case[];
  view?: "card" | "table";
  onViewAll?: () => void;
}

const RecentCases: React.FC<Props> = ({ cases, view = "card", onViewAll }) => {
  /* ================= CARD VIEW ================= */
  if (view === "card") {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h3 className="card-title text-2xl font-black">Recent Cases</h3>

          <div className="space-y-4">
            {cases.length > 0 ? (
              cases.map((caseItem) => (
                <div
                  key={caseItem.id}
                  className={`border-l-4 ${
                    caseItem.detained ? "border-error" : "border-success"
                  } pl-4 py-2`}
                >
                  <p className="font-semibold">
                    {caseItem.caseNumber} - {caseItem.charge}
                  </p>

                  <p className="text-sm opacity-70">
                    {caseItem.name} | Branch: {caseItem.branch}
                  </p>

                  <p className="text-sm opacity-70">
                    Filed: {new Date(caseItem.dateFiled).toLocaleDateString()}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-4 opacity-70 text-xl">
                No cases found
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ================= TABLE VIEW ================= */

  return (
    <div className="bg-base-100 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-4xl font-bold">Recent Cases</h3>

        {onViewAll && (
          <button className="btn btn-sm btn-ghost" onClick={onViewAll}>
            View All →
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="table border-separate border-spacing-y-2 text-center">
          {/* HEADER */}
          <thead className="bg-base-300">
            <tr className="text-sm uppercase tracking-wide text-base-content/60 text-center">
              <th>Case Number</th>
              <th>Name</th>
              <th>Charge</th>
              <th>Branch</th>
              <th>Date Filed</th>
              <th>Status</th>
            </tr>
          </thead>

          {/* BODY */}
          <tbody>
            {cases.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center py-6 text-base-content/50"
                >
                  No recent cases
                </td>
              </tr>
            ) : (
              cases.map((caseItem) => (
                <tr
                  key={caseItem.id}
                  className="bg-base-100 hover:bg-base-200 transition rounded-xl"
                >
                  {/* Case Number */}
                  <td className="font-semibold text-base">
                    {caseItem.caseNumber}
                  </td>

                  {/* Name */}
                  <td className="text-base-content/80 font-medium">
                    {caseItem.name}
                  </td>

                  {/* Charge */}
                  <td className="text-base-content/70">{caseItem.charge}</td>

                  {/* Branch */}
                  <td className="text-base-content/70">{caseItem.branch}</td>

                  {/* Date */}
                  <td className="text-base-content/60 text-sm">
                    {new Date(caseItem.dateFiled).toLocaleDateString()}
                  </td>

                  {/* Status */}
                  <td>
                    <span
                      className={`badge backdrop-blur-md border font-medium
                ${
                  caseItem.detained
                    ? "bg-red-500/15 text-red-600 border-red-400/30"
                    : "bg-emerald-500/15 text-emerald-600 border-emerald-400/30"
                }`}
                    >
                      {caseItem.detained ? "Detained" : "Free"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentCases;
