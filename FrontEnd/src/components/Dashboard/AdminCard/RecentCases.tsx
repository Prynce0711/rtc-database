import React from "react";
import type { Case } from "../../../generated/prisma/client";

interface RecentCasesProps {
  cases: Case[];
  onViewAll?: () => void;
}

const RecentCases: React.FC<RecentCasesProps> = ({ cases, onViewAll }) => {
  return (
    <div className="bg-base-100 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">Recent Cases</h3>
        {onViewAll && (
          <button className="btn btn-sm btn-ghost" onClick={onViewAll}>
            View All →
          </button>
        )}
      </div>
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
            {cases.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center opacity-50">
                  No recent cases
                </td>
              </tr>
            ) : (
              cases.map((caseItem) => (
                <tr key={caseItem.id} className="hover">
                  <td className="font-medium">{caseItem.caseNumber}</td>
                  <td>{caseItem.name}</td>
                  <td>{caseItem.charge}</td>
                  <td>{caseItem.branch}</td>
                  <td>{new Date(caseItem.dateFiled).toLocaleDateString()}</td>
                  <td>
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
