/**
 * Recent Cases Table Component
 *
 * Displays a table of recent court cases with:
 * - Case number, name, charge, branch
 * - Date filed
 * - Detention status badge
 * - Optional "View All" button to navigate to full case list
 *
 * Shows empty state message when no cases are available.
 */

import React from "react";
import type { Case } from "../../../generated/prisma/client";

/** Props for the RecentCases component */
interface RecentCasesProps {
  /** Array of cases to display in the table */
  cases: Case[];
  /** Optional callback when "View All" button is clicked */
  onViewAll?: () => void;
}

const RecentCases: React.FC<RecentCasesProps> = ({ cases, onViewAll }) => {
  return (
    <div className="bg-base-100 rounded-lg shadow p-6">
      {/* Header with title and optional View All button */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-3xl font-bold">Recent Cases</h3>
        {/* Only show View All button if callback is provided */}
        {onViewAll && (
          <button
            className="btn btn-sm btn-ghost font-black text-md"
            onClick={onViewAll}
          >
            View All →
          </button>
        )}
      </div>
      {/* Scrollable table container for mobile responsiveness */}
      <div className="overflow-x-auto">
        <table className="table border-separate border-spacing-y-2">
          {/* HEADER */}
          <thead className="bg-base-300">
            <tr className="text-sm uppercase tracking-wide text-base-content/60">
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
