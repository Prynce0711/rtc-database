"use client";
import { Case } from "@/app/generated/prisma/browser";
import React, { useEffect, useState } from "react";
import {
  CaseFormData,
  initialCaseFormData,
  validateCaseForm,
} from "./CaseForms";
import { createCase, updateCase } from "./CasesActions";

export enum CaseModalType {
  ADD = "ADD",
  EDIT = "EDIT",
}

const NewCaseModal = ({
  type,
  onClose,
  selectedCase = null,
  onCreate,
  onUpdate,
}: {
  type: CaseModalType;
  onClose: () => void;
  selectedCase?: Case | null;
  onCreate?: (caseData: Case) => void;
  onUpdate?: (caseData: Case) => void;
}) => {
  const [formData, setFormData] = useState<CaseFormData>(initialCaseFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (type === CaseModalType.EDIT && selectedCase) {
      setFormData({
        branch: selectedCase.branch,
        assistantBranch: selectedCase.assistantBranch,
        caseNumber: selectedCase.caseNumber,
        dateFiled: new Date(selectedCase.dateFiled),
        name: selectedCase.name,
        charge: selectedCase.charge,
        infoSheet: selectedCase.infoSheet,
        court: selectedCase.court,
        detained: selectedCase.detained,
        consolidation: selectedCase.consolidation,
        eqcNumber: selectedCase.eqcNumber ?? undefined,
        bond: selectedCase.bond,
        raffleDate: selectedCase.raffleDate
          ? new Date(selectedCase.raffleDate)
          : undefined,
        committe1: selectedCase.committe1 ?? undefined,
        committe2: selectedCase.committe2 ?? undefined,
      });
    } else {
      setFormData(initialCaseFormData);
    }
  }, [type, selectedCase]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const errors = validateCaseForm(formData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      const caseDataToSend = {
        ...formData,
        dateFiled: formData.dateFiled.toISOString(),
        raffleDate: formData.raffleDate?.toISOString(),
      };

      if (type === CaseModalType.EDIT && selectedCase) {
        const response = await updateCase(selectedCase.id, caseDataToSend);
        if (!response.success) {
          throw new Error(response.error || "Failed to update case");
        }
        if (onUpdate) {
          onUpdate(response.result);
        }
      } else {
        const response = await createCase(caseDataToSend);
        if (!response.success) {
          throw new Error(response.error || "Failed to create case");
        }
        if (onCreate) {
          onCreate(response.result);
        }
      }

      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save case");
    }
  };

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-3xl">
        <h3 className="font-bold text-lg mb-4">
          {type === CaseModalType.EDIT ? "Edit Case" : "Add New Case"}
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            {/* Branch */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Branch *</span>
              </label>
              <input
                type="text"
                className={`input input-bordered ${formErrors.branch ? "input-error" : ""}`}
                value={formData.branch}
                onChange={(e) =>
                  setFormData({ ...formData, branch: e.target.value })
                }
              />
              {formErrors.branch && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {formErrors.branch}
                  </span>
                </label>
              )}
            </div>

            {/* Assistant Branch */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Assistant Branch *</span>
              </label>
              <input
                type="text"
                className={`input input-bordered ${formErrors.assistantBranch ? "input-error" : ""}`}
                value={formData.assistantBranch}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    assistantBranch: e.target.value,
                  })
                }
              />
              {formErrors.assistantBranch && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {formErrors.assistantBranch}
                  </span>
                </label>
              )}
            </div>

            {/* Case Number */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Case Number *</span>
              </label>
              <input
                type="text"
                className={`input input-bordered ${formErrors.caseNumber ? "input-error" : ""}`}
                value={formData.caseNumber}
                onChange={(e) =>
                  setFormData({ ...formData, caseNumber: e.target.value })
                }
              />
              {formErrors.caseNumber && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {formErrors.caseNumber}
                  </span>
                </label>
              )}
            </div>

            {/* Name */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Name *</span>
              </label>
              <input
                type="text"
                className={`input input-bordered ${formErrors.name ? "input-error" : ""}`}
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
              {formErrors.name && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {formErrors.name}
                  </span>
                </label>
              )}
            </div>

            {/* Charge */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Charge *</span>
              </label>
              <input
                type="text"
                className={`input input-bordered ${formErrors.charge ? "input-error" : ""}`}
                value={formData.charge}
                onChange={(e) =>
                  setFormData({ ...formData, charge: e.target.value })
                }
              />
              {formErrors.charge && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {formErrors.charge}
                  </span>
                </label>
              )}
            </div>

            {/* Info Sheet */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Info Sheet *</span>
              </label>
              <input
                type="text"
                className={`input input-bordered ${formErrors.infoSheet ? "input-error" : ""}`}
                value={formData.infoSheet}
                onChange={(e) =>
                  setFormData({ ...formData, infoSheet: e.target.value })
                }
              />
              {formErrors.infoSheet && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {formErrors.infoSheet}
                  </span>
                </label>
              )}
            </div>

            {/* Court */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Court *</span>
              </label>
              <input
                type="text"
                className={`input input-bordered ${formErrors.court ? "input-error" : ""}`}
                value={formData.court}
                onChange={(e) =>
                  setFormData({ ...formData, court: e.target.value })
                }
              />
              {formErrors.court && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {formErrors.court}
                  </span>
                </label>
              )}
            </div>

            {/* Consolidation */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Consolidation *</span>
              </label>
              <input
                type="text"
                className={`input input-bordered ${formErrors.consolidation ? "input-error" : ""}`}
                value={formData.consolidation}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    consolidation: e.target.value,
                  })
                }
              />
              {formErrors.consolidation && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {formErrors.consolidation}
                  </span>
                </label>
              )}
            </div>

            {/* Date Filed */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Date Filed *</span>
              </label>
              <input
                type="date"
                className="input input-bordered"
                value={formData.dateFiled.toISOString().split("T")[0]}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dateFiled: new Date(e.target.value),
                  })
                }
              />
            </div>

            {/* Bond */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Bond *</span>
              </label>
              <input
                type="number"
                step="0.01"
                className={`input input-bordered ${formErrors.bond ? "input-error" : ""}`}
                value={formData.bond}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bond: parseFloat(e.target.value) || 0,
                  })
                }
              />
              {formErrors.bond && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {formErrors.bond}
                  </span>
                </label>
              )}
            </div>

            {/* Detained */}
            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-4">
                <span className="label-text">Detained</span>
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={formData.detained}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      detained: e.target.checked,
                    })
                  }
                />
              </label>
            </div>

            {/* Raffle Date */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Raffle Date</span>
              </label>
              <input
                type="date"
                className="input input-bordered"
                value={formData.raffleDate?.toISOString().split("T")[0] || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    raffleDate: e.target.value
                      ? new Date(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>

            {/* EQC Number */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">EQC Number</span>
              </label>
              <input
                type="number"
                className="input input-bordered"
                value={formData.eqcNumber || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    eqcNumber: e.target.value
                      ? parseInt(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>

            {/* Committee 1 */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Committee 1</span>
              </label>
              <input
                type="number"
                className="input input-bordered"
                value={formData.committe1 || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    committe1: e.target.value
                      ? parseInt(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>

            {/* Committee 2 */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Committee 2</span>
              </label>
              <input
                type="number"
                className="input input-bordered"
                value={formData.committe2 || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    committe2: e.target.value
                      ? parseInt(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>
          </div>

          <div className="modal-action">
            <button
              type="button"
              className="btn"
              onClick={() => {
                onClose();
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {type === CaseModalType.EDIT ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button
          onClick={() => {
            onClose();
          }}
        >
          close
        </button>
      </form>
    </dialog>
  );
};

export default NewCaseModal;
