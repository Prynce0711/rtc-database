import React from "react";
import type { Case } from "../../../generated/prisma/client";
interface CaseModalProps {
  caseData: Case;
  onClose: () => void;
}

const CaseModal: React.FC<CaseModalProps> = ({ caseData, onClose }) => {
  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-4xl">
        <h3 className="font-bold text-2xl mb-6">Case Details</h3>

        {/* Case Number Header */}
        <div className="bg-primary text-primary-content p-4 rounded-lg mb-6">
          <div className="text-sm opacity-80">Case Number</div>
          <div className="text-2xl font-bold">{caseData.caseNumber}</div>
        </div>

        {/* Case Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Branch</span>
              </label>
              <div className="p-3 bg-base-200 rounded-lg">
                {caseData.branch}
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">ASST. BR.</span>
              </label>
              <div className="p-3 bg-base-200 rounded-lg">
                {caseData.assistantBranch}
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Date Filed</span>
              </label>
              <div className="p-3 bg-base-200 rounded-lg">
                {new Date(caseData.dateFiled).toLocaleDateString()}
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Name</span>
              </label>
              <div className="p-3 bg-base-200 rounded-lg">{caseData.name}</div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Charge</span>
              </label>
              <div className="p-3 bg-base-200 rounded-lg">
                {caseData.charge}
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Info Sheet</span>
              </label>
              <div className="p-3 bg-base-200 rounded-lg">
                {caseData.infoSheet}
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Court</span>
              </label>
              <div className="p-3 bg-base-200 rounded-lg">{caseData.court}</div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Detained</span>
              </label>
              <div className="p-3 bg-base-200 rounded-lg">
                <span
                  className={`badge ${
                    caseData.detained ? "badge-error" : "badge-success"
                  }`}
                >
                  {caseData.detained ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Consolidation</span>
              </label>
              <div className="p-3 bg-base-200 rounded-lg">
                <span
                  className={`badge ${
                    caseData.consolidation === "Yes"
                      ? "badge-info"
                      : "badge-ghost"
                  }`}
                >
                  {caseData.consolidation}
                </span>
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">ECQ NO.</span>
              </label>
              <div className="p-3 bg-base-200 rounded-lg">
                {caseData.eqcNumber ?? "N/A"}
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Bond</span>
              </label>
              <div className="p-3 bg-base-200 rounded-lg">
                <span className="text-lg font-semibold text-success">
                  ${caseData.bond.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Raffle Date</span>
              </label>
              <div className="p-3 bg-base-200 rounded-lg">
                {caseData.raffleDate
                  ? new Date(caseData.raffleDate).toLocaleDateString()
                  : "N/A"}
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Committee 1</span>
              </label>
              <div className="p-3 bg-base-200 rounded-lg">
                {caseData.committe1 ?? "N/A"}
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Committee 2</span>
              </label>
              <div className="p-3 bg-base-200 rounded-lg">
                {caseData.committe2 ?? "N/A"}
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Complainant</span>
              </label>
              <div className="p-3 bg-base-200 rounded-lg">
                {caseData.complainant}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="modal-action mt-8">
          <button className="btn btn-outline">Edit Case</button>
          <button className="btn btn-outline btn-error">Delete Case</button>
          <button onClick={onClose} className="btn btn-primary">
            Close
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
};

export default CaseModal;
