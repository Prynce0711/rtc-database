import React from "react";

interface CaseData {
  id: number;
  branch: string;
  asstBr: string;
  caseNo: string;
  dateFilled: string;
  name: string;
  charge: string;
  infoSheet: string;
  courtDetained: string;
  consolidation: string;
  ecqNo: string;
  bond: string;
  raffleDate: string;
  committee1: string;
  committee2: string;
}

interface CaseModalProps {
  caseData: CaseData;
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
          <div className="text-2xl font-bold">{caseData.caseNo}</div>
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
                {caseData.asstBr}
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Date Filled</span>
              </label>
              <div className="p-3 bg-base-200 rounded-lg">
                {caseData.dateFilled}
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
                <span className="label-text font-semibold">Court Detained</span>
              </label>
              <div className="p-3 bg-base-200 rounded-lg">
                <span
                  className={`badge ${
                    caseData.courtDetained === "Yes"
                      ? "badge-error"
                      : "badge-success"
                  }`}
                >
                  {caseData.courtDetained}
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
              <div className="p-3 bg-base-200 rounded-lg">{caseData.ecqNo}</div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Bond</span>
              </label>
              <div className="p-3 bg-base-200 rounded-lg">
                <span className="text-lg font-semibold text-success">
                  {caseData.bond}
                </span>
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Raffle Date</span>
              </label>
              <div className="p-3 bg-base-200 rounded-lg">
                {caseData.raffleDate}
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Committee 1</span>
              </label>
              <div className="p-3 bg-base-200 rounded-lg">
                {caseData.committee1}
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Committee 2</span>
              </label>
              <div className="p-3 bg-base-200 rounded-lg">
                {caseData.committee2}
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
