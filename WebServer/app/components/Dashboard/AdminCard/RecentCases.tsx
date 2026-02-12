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
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-start justify-between">
              <h3 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight">
                Recent Cases
              </h3>

              {onViewAll && (
                <button
                  onClick={onViewAll}
                  className="btn btn-sm btn-outline btn-primary"
                >
                  View All
                </button>
              )}
            </div>
          </div>
          {/* Cases */}
          <div className="space-y-3">
            {cases.length > 0 ? (
              cases.map((caseItem) => (
                <div
                  key={caseItem.id}
                  className={`p-4 rounded-xl border-l-4 bg-base-200 hover:bg-base-300 transition
                  ${caseItem.detained ? "border-warning" : "border-success"}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-base">
                        {caseItem.caseNumber}
                      </p>

                      <p className="text-sm text-base-content/70">
                        {caseItem.name}
                      </p>
                    </div>

                    <span
                      className={`badge badge-md font-semibold
                        ${
                          caseItem.detained ? "badge-warning" : "badge-success"
                        }`}
                    >
                      {caseItem.detained ? "Detained" : "Free"}
                    </span>
                  </div>

                  <p className="text-sm text-base-content/70 mt-2">
                    {caseItem.charge}
                  </p>

                  <p className="text-xs text-base-content/50 mt-1">
                    {caseItem.branch} •{" "}
                    {new Date(caseItem.dateFiled).toLocaleDateString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-center py-8 text-base-content/50 font-medium">
                No cases found
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ================= TABLE VIEW ================= */

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body overflow-visible">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold">Recent Cases</h3>

          {onViewAll && (
            <button
              className="btn btn-sm btn-outline btn-primary"
              onClick={onViewAll}
            >
              View All
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="table table-zebra text-center">
            {/* HEADER */}
            <thead>
              <tr className="text-sm font-semibold text-base-content/60">
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
                    className="py-10 text-base-content/50 font-medium"
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
                    <td className="font-semibold py-4">
                      {caseItem.caseNumber}
                    </td>

                    <td className="font-medium text-base-content/80">
                      {caseItem.name}
                    </td>

                    <td className="text-base-content/70">{caseItem.charge}</td>

                    <td className="text-base-content/70">{caseItem.branch}</td>

                    <td className="text-sm text-base-content/60">
                      {new Date(caseItem.dateFiled).toLocaleDateString()}
                    </td>

                    <td>
                      <span
                        className={`badge badge-md font-semibold
                        ${
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
    </div>
  );
};

export default RecentCases;
