"use client";

import { Case } from "@/app/generated/prisma/browser";
import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import { FiDollarSign, FiFileText, FiUsers, FiX } from "react-icons/fi";
import { z } from "zod";
import { usePopup } from "../Popup/PopupProvider";
import { createCase, updateCase } from "./CasesActions";
import FormField from "./FormField";
import { CaseSchema, initialCaseFormData } from "./schema";

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
  const [formData, setFormData] = useState<CaseSchema>(initialCaseFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const statusPopup = usePopup();
  const formRef = React.useRef<HTMLFormElement | null>(null);

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
        bond: selectedCase.bond ?? undefined,
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

  const getFieldErrors = (
    issues: z.core.$ZodIssue[],
  ): Record<string, string> => {
    const errors: Record<string, string> = {};
    issues.forEach((issue) => {
      const key = issue.path[0];
      if (typeof key === "string" && !errors[key]) {
        errors[key] = issue.message;
      }
    });
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (
      !(await statusPopup.showConfirm(
        type === CaseModalType.EDIT
          ? "Are you sure you want to update this case?"
          : "Are you sure you want to create this case?",
      ))
    )
      return;

    const validation = CaseSchema.safeParse(formData);
    if (!validation.success) {
      setFormErrors(getFieldErrors(validation.error.issues));
      return;
    }
    setFormErrors({});

    setIsSubmitting(true);
    statusPopup.showLoading(
      type === CaseModalType.EDIT ? "Updating case..." : "Creating case...",
    );

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
        statusPopup.showSuccess("Case updated successfully");
      } else {
        const response = await createCase(caseDataToSend);
        if (!response.success) {
          throw new Error(response.error || "Failed to create case");
        }
        if (onCreate) {
          onCreate(response.result);
        }
        statusPopup.showSuccess("Case created successfully");
      }

      onClose();
    } catch (err) {
      statusPopup.showError(
        err instanceof Error ? err.message : "Failed to save case",
      );
    } finally {
      setIsSubmitting(false);
      statusPopup.hidePopup();
    }
  };

  if (!onClose) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => onClose()}
        />
      </AnimatePresence>

      <AnimatePresence>
        <motion.div
          className="fixed right-0 top-0 h-full w-full md:w-[720px] lg:w-[900px] bg-base-100 shadow-2xl z-50 overflow-hidden border-l border-base-300 rounded-l-xl flex flex-col"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
        >
          {/* Header */}
          <div className="sticky top-0 z-20 bg-gradient-to-r from-blue-600 to-sky-400 text-white p-6 rounded-tl-xl flex items-center justify-between gap-4 shadow-md">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white text-xl font-semibold">
                {type === CaseModalType.EDIT ? "E" : "+"}
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-semibold leading-tight">
                  {type === CaseModalType.EDIT ? "Edit Case" : "Add Case"}
                </h2>
                <p className="text-sm text-white/90 mt-1">
                  Fill in case details
                </p>
              </div>
            </div>
            <button
              onClick={() => onClose()}
              className="btn btn-ghost btn-sm btn-circle bg-white/10 hover:bg-white/20 text-white"
              aria-label="Close drawer"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Content (scrollable) */}
          <div className="flex-1 overflow-auto p-8 text-bold text-base-content/90">
            <form
              ref={formRef}
              onSubmit={handleSubmit}
              className="max-w-[1100px] mx-auto space-y-6"
            >
              <div className="mb-2 -mt-2">
                <div>
                  <h3 className="text-lg font-semibold">
                    {type === CaseModalType.EDIT
                      ? formData.name || "Edit Case"
                      : "New Case"}
                  </h3>
                  <p className="text-sm text-base-content/60">
                    {formData.caseNumber || "Case number"}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Case Information Card */}
                <div className="card rounded-2xl shadow-sm border">
                  <div className="card-body p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="p-2 rounded-md bg-sky-100 text-sky-600">
                        <FiFileText />
                      </div>
                      <div>
                        <h4 className="font-semibold">Case Information</h4>
                        <p className="text-xs text-base-content/60">
                          Branch, case number and basic details
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField label={"Branch *"} error={formErrors.branch}>
                        <input
                          type="text"
                          className={`input input-bordered ${formErrors.branch ? "input-error" : ""}`}
                          value={formData.branch}
                          onChange={(e) =>
                            setFormData({ ...formData, branch: e.target.value })
                          }
                        />
                      </FormField>

                      <FormField
                        label={"Assistant Branch *"}
                        error={formErrors.assistantBranch}
                      >
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
                      </FormField>

                      <FormField
                        label={"Case Number *"}
                        error={formErrors.caseNumber}
                      >
                        <input
                          type="text"
                          className={`input input-bordered ${formErrors.caseNumber ? "input-error" : ""}`}
                          value={formData.caseNumber}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              caseNumber: e.target.value,
                            })
                          }
                        />
                      </FormField>

                      <FormField label={"Name *"} error={formErrors.name}>
                        <input
                          type="text"
                          className={`input input-bordered ${formErrors.name ? "input-error" : ""}`}
                          value={formData.name}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                        />
                      </FormField>

                      <FormField label={"Charge *"} error={formErrors.charge}>
                        <input
                          type="text"
                          className={`input input-bordered ${formErrors.charge ? "input-error" : ""}`}
                          value={formData.charge}
                          onChange={(e) =>
                            setFormData({ ...formData, charge: e.target.value })
                          }
                        />
                      </FormField>

                      <FormField
                        label={"Info Sheet *"}
                        error={formErrors.infoSheet}
                      >
                        <input
                          type="text"
                          className={`input input-bordered ${formErrors.infoSheet ? "input-error" : ""}`}
                          value={formData.infoSheet}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              infoSheet: e.target.value,
                            })
                          }
                        />
                      </FormField>

                      <FormField label={"Court *"} error={formErrors.court}>
                        <input
                          type="text"
                          className={`input input-bordered ${formErrors.court ? "input-error" : ""}`}
                          value={formData.court}
                          onChange={(e) =>
                            setFormData({ ...formData, court: e.target.value })
                          }
                        />
                      </FormField>

                      <FormField
                        label={"Consolidation *"}
                        error={formErrors.consolidation}
                      >
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
                      </FormField>
                    </div>
                  </div>
                </div>

                {/* Filing & Status Card */}
                <div className="card rounded-2xl shadow-sm border">
                  <div className="card-body p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="p-2 rounded-md bg-amber-100 text-amber-600">
                        <FiDollarSign />
                      </div>
                      <div>
                        <h4 className="font-semibold">Filing & Status</h4>
                        <p className="text-xs text-base-content/60">
                          Dates, bond and detention status
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-semibold block mb-1">
                            Date Filed *
                          </span>
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

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-semibold block mb-1">
                            Raffle Date
                          </span>
                        </label>
                        <input
                          type="date"
                          className="input input-bordered"
                          value={
                            formData.raffleDate?.toISOString().split("T")[0] ||
                            ""
                          }
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

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-semibold block mb-1">
                            Detained
                          </span>
                        </label>
                        <div>
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
                        </div>
                      </div>

                      <FormField label={"Bond"} error={formErrors.bond}>
                        <input
                          type="number"
                          step="0.01"
                          className={`input input-bordered ${formErrors.bond ? "input-error" : ""}`}
                          value={formData.bond ?? ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              bond: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </FormField>

                      <FormField label={"EQC Number"}>
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
                      </FormField>
                    </div>
                  </div>
                </div>

                {/* Committees Card */}
                <div className="card rounded-2xl shadow-sm border">
                  <div className="card-body p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="p-2 rounded-md bg-green-100 text-green-600">
                        <FiUsers />
                      </div>
                      <div>
                        <h4 className="font-semibold">Committee Assignment</h4>
                        <p className="text-xs text-base-content/60">
                          Assign committees for review
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-semibold block mb-1">
                            Committee 1
                          </span>
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

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-semibold block mb-1">
                            Committee 2
                          </span>
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
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Footer (sticky) */}
          <div className="sticky bottom-0 z-30 bg-base-100 border-t border-base-300 p-4 flex justify-end gap-3">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onClose()}
            >
              Close
            </button>
            <button
              type="button"
              className={`btn btn-primary px-8 ${isSubmitting ? "loading" : ""}`}
              onClick={() =>
                (formRef.current as HTMLFormElement)?.requestSubmit()
              }
            >
              {type === CaseModalType.EDIT ? "Update" : "Create"}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
};

export default NewCaseModal;
