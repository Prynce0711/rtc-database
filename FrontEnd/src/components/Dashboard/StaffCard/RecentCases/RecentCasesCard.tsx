import React from "react";
import type { Case } from "../../../../generated/prisma/client";

interface RecentCasesCardProps {
  cases: Case[];
}

const RecentCasesCard: React.FC<RecentCasesCardProps> = ({ cases }) => {
  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h3 className="card-title">Recent Cases</h3>
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
            <div className="text-center py-4 opacity-70">No cases found</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecentCasesCard;
