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
        <table className="table table-sm">
          <thead className="bg-base-300 text-xl">
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
            {cases.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center opacity-50">
                  No recent cases
                </td>
              </tr>
            ) : (
              cases.map((caseItem) => (
                <tr key={caseItem.id} className="hover text-lg">
                  <td className="font-medium text-lg">{caseItem.caseNumber}</td>
                  <td>{caseItem.name}</td>
                  <td>{caseItem.charge}</td>
                  <td>{caseItem.branch}</td>
                  <td>{new Date(caseItem.dateFiled).toLocaleDateString()}</td>
                  <td>
                    <span
                      className={`badge ${
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
