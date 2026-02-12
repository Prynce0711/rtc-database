/**
 * Recent Cases Table Component
 *
 * Displays a table of recent court cases with:
 * - Case number, name, charge, branch
 * - Date filed
 * - Detention status badge
 * - Optional "View All" button
 */

import React from "react";
import type { Case } from "../../../generated/prisma/client";

interface RecentCasesProps {
  cases: Case[];
  onViewAll?: () => void;
}

const RecentCases: React.FC<RecentCasesProps> = ({ cases, onViewAll }) => {
  return (
    <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
      <div className="card-body">
        {/* ===== Header ===== */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-3xl sm:text-4xl font-black tracking-tight">
            Recent Cases
          </h3>

          {onViewAll && (
            <button
              className="btn btn-sm btn-outline btn-primary"
              onClick={onViewAll}
            >
              View All →
            </button>
          )}
        </div>

        {/* ===== Table ===== */}
        <div className="overflow-x-auto">
          <table className="table table-zebra text-center">
            {/* HEADER */}
            <thead>
              <tr className="text-xs sm:text-sm uppercase tracking-wide text-base-content/60">
                <th>Case</th>
                <th>Client</th>
                <th>Charge</th>
                <th>Branch</th>
                <th>Filed</th>
                <th>Status</th>
              </tr>
            </thead>

            {/* BODY */}
            <tbody>
              {cases.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-12 text-base-content/50 font-medium"
                  >
                    No recent cases
                  </td>
                </tr>
              ) : (
                cases.map((caseItem) => (
                  <tr
                    key={caseItem.id}
                    className="hover:bg-base-200 transition"
                  >
                    {/* Case Number */}
                    <td className="font-semibold py-4">
                      {caseItem.caseNumber}
                    </td>

                    {/* Client */}
                    <td className="font-medium text-base-content/80">
                      {caseItem.name}
                    </td>

                    {/* Charge */}
                    <td className="text-base-content/70">{caseItem.charge}</td>

                    {/* Branch */}
                    <td className="text-base-content/70">{caseItem.branch}</td>

                    {/* Date */}
                    <td className="text-sm text-base-content/60">
                      {new Date(caseItem.dateFiled).toLocaleDateString()}
                    </td>

                    {/* Status */}
                    <td>
                      <span
                        className={`badge badge-md font-semibold
                          ${
                            caseItem.detained
                              ? "badge-warning"
                              : "badge-success"
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
    </div>
  );
};

export default RecentCases;
