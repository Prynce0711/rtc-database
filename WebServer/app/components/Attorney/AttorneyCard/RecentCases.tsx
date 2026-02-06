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
        <h3 className="text-xl font-bold">Recent Cases</h3>
        {/* Only show View All button if callback is provided */}
        {onViewAll && (
          <button className="btn btn-sm btn-ghost" onClick={onViewAll}>
            View All →
          </button>
        )}
      </div>
      {/* Scrollable table container for mobile responsiveness */}
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Case Number</th>
              <th>Name</th>
              <th>Charge</th>
              <th>Branch</th>
              <th>Date Filed</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {/* Show empty state message if no cases */}
            {cases.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center opacity-50">
                  No recent cases
                </td>
              </tr>
            ) : (
              /* Map through cases and display each row */
              cases.map((caseItem) => (
                <tr key={caseItem.id} className="hover">
                  <td className="font-medium">{caseItem.caseNumber}</td>
                  <td>{caseItem.name}</td>
                  <td>{caseItem.charge}</td>
                  <td>{caseItem.branch}</td>
                  <td>{new Date(caseItem.dateFiled).toLocaleDateString()}</td>
                  <td>
                    {/* Status badge: warning for detained, success for free */}
                    <span
                      className={`badge badge-sm ${
                        caseItem.detained ? "badge-warning" : "badge-success"
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
