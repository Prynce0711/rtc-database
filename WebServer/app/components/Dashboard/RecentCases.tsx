import React from "react";
import type { UnifiedCaseData } from "../CaseActions";

interface RecentCasesProps {
  cases: UnifiedCaseData[];
  view?: "card" | "table";
  onViewAll?: () => void;
}

const RecentCases: React.FC<RecentCasesProps> = ({
  cases,
  view = "card",
  onViewAll,
}) => {
  if (view === "card") {
    return (
      <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
        <div className="card-body">
          <div className="flex items-start justify-between mb-6">
            <h3 className="text-3xl sm:text-4xl font-black tracking-tight">
              Recent Cases
            </h3>

            {onViewAll && (
              <button
                className="btn btn-sm btn-outline btn-primary"
                onClick={onViewAll}
              >
                View All
              </button>
            )}
          </div>

          <div className="space-y-3">
            {cases.length > 0 ? (
              cases.map((caseItem) => (
                <div
                  key={caseItem.id}
                  className={`p-4 rounded-xl border-l-4 bg-base-200 hover:bg-base-300 transition ${caseItem.isDetained ? "border-warning" : "border-success"}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-base">
                        {caseItem.caseNumber}
                      </p>
                      <p className="text-sm text-base-content/70">
                        {caseItem.displayParty}
                      </p>
                    </div>

                    <span
                      className={`badge badge-md font-semibold ${caseItem.isDetained ? "badge-warning" : "badge-success"}`}
                    >
                      {caseItem.statusText}
                    </span>
                  </div>

                  <p className="text-sm text-base-content/70 mt-2">
                    {caseItem.displayDetail}
                  </p>

                  <p className="text-xs text-base-content/50 mt-1">
                    {caseItem.branch || "Unassigned"} •{" "}
                    {caseItem.dateFiled
                      ? new Date(caseItem.dateFiled).toLocaleDateString()
                      : "No date"}
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

  return (
    <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
      <div className="card-body overflow-visible">
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
            <thead>
              <tr className="text-sm font-semibold text-base-content/60">
                <th>Case</th>
                <th>Party</th>
                <th>Detail</th>
                <th>Branch</th>
                <th>Filed</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {cases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-base-content/50">
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
                      {caseItem.displayParty}
                    </td>
                    <td className="text-base-content/70">
                      {caseItem.displayDetail}
                    </td>
                    <td className="text-base-content/70">
                      {caseItem.branch || "Unassigned"}
                    </td>
                    <td className="text-sm text-base-content/60">
                      {caseItem.dateFiled
                        ? new Date(caseItem.dateFiled).toLocaleDateString()
                        : "No date"}
                    </td>
                    <td>
                      <span
                        className={`badge badge-md font-semibold ${caseItem.isDetained ? "badge-warning" : "badge-success"}`}
                      >
                        {caseItem.statusText}
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
