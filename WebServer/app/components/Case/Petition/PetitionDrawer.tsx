"use client";

import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import { FiFileText, FiMapPin, FiX } from "react-icons/fi";
import { usePopup } from "../../Popup/PopupProvider";
import FormField from "../FormField";
import { ReceiveLog } from "./PetitionRecord";

export enum ReceiveDrawerType {
  ADD = "ADD",
  EDIT = "EDIT",
}

const EMPTY_FORM: Record<string, any> = {
  caseNumber: "",
  raffledToBranch: "",
  dateFiled: new Date().toISOString().slice(0, 10),
  petitioners: "",
  titleNo: "",
  nature: "",
};

const ReceiveDrawer = ({
  type,
  onClose,
  selectedLog = null,
  onCreate,
  onUpdate,
}: {
  type: ReceiveDrawerType;
  onClose: () => void;
  selectedLog?: ReceiveLog | null | any;
  onCreate?: (log: any) => void;
  onUpdate?: (log: any) => void;
}) => {
  const [formData, setFormData] = useState<Record<string, any>>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"FORM" | "REVIEW">("FORM");
  const statusPopup = usePopup();

  useEffect(() => {
    if (type === ReceiveDrawerType.EDIT && selectedLog) {
      setFormData({
        ...EMPTY_FORM,
        caseNumber: selectedLog.caseNumber ?? selectedLog["Case No"] ?? "",
        raffledToBranch:
          selectedLog.RaffledToBranch ??
          selectedLog["Branch No"] ??
          selectedLog.branch ??
          "",
        dateFiled: selectedLog.dateReceived
          ? String(selectedLog.dateReceived).slice(0, 10)
          : EMPTY_FORM.dateFiled,
        petitioners: selectedLog.Petitioners ?? selectedLog.party ?? "",
        titleNo:
          selectedLog.TitleNo ??
          selectedLog.BookAndPages ??
          selectedLog.receiptNo ??
          "",
        nature:
          selectedLog.Nature ??
          selectedLog.Content ??
          selectedLog.documentType ??
          "",
      });
    } else {
      setFormData(EMPTY_FORM);
    }
    setFormErrors({});
    setStep("FORM");
  }, [type, selectedLog]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validateRequired = (keys: string[]) => {
    const errs: Record<string, string> = {};
    keys.forEach((k) => {
      if (!formData[k] || String(formData[k]).trim() === "") {
        errs[k] = "This field is required";
      }
    });
    return errs;
  };

  const handleReview = () => {
    const required = [
      "caseNumber",
      "raffledToBranch",
      "dateFiled",
      "petitioners",
      "titleNo",
      "nature",
    ];
    const errs = validateRequired(required);
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }
    setFormErrors({});
    setStep("REVIEW");
  };

  const handleSubmit = async () => {
    if (
      !(await statusPopup.showConfirm(
        type === ReceiveDrawerType.ADD
          ? "Create this petition entry?"
          : "Save changes to this petition entry?",
      ))
    )
      return;

    setIsSubmitting(true);
    try {
      const payload = {
        id: selectedLog?.id ?? 0,
        caseNumber: formData.caseNumber,
        branch: formData.raffledToBranch,
        dateReceived: formData.dateFiled,
        party: formData.petitioners,
        receiptNo: formData.titleNo,
        documentType: formData.nature,
        "Case No": formData.caseNumber,
        "Branch No": formData.raffledToBranch,
        BookAndPages: formData.titleNo,
        Content: formData.nature,
        RaffledToBranch: formData.raffledToBranch,
        Petitioners: formData.petitioners,
        TitleNo: formData.titleNo,
        Nature: formData.nature,
      } as any;

      if (type === ReceiveDrawerType.ADD) {
        onCreate?.(payload);
      } else {
        onUpdate?.(payload);
      }

      statusPopup.showSuccess(
        type === ReceiveDrawerType.ADD
          ? "Petition entry created successfully"
          : "Petition entry updated successfully",
      );
      onClose();
    } catch (err) {
      statusPopup.showError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const dateValue = formData.dateFiled
    ? (formData.dateFiled instanceof Date
        ? formData.dateFiled
        : new Date(String(formData.dateFiled))
      )
        .toISOString()
        .slice(0, 10)
    : "";

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/40 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <motion.div
        className="fixed right-0 top-0 h-full w-full max-w-xl bg-base-100 shadow-2xl z-50 flex flex-col"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
      >
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl md:text-4xl font-semibold leading-tight">
                {type === ReceiveDrawerType.ADD
                  ? "New Petition Entry"
                  : "Edit Petition Entry"}
              </h2>
              <p className="text-sm text-base-content/60 mt-1">
                Fill in petition details
              </p>
            </div>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm btn-circle"
              aria-label="Close drawer"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-2 mb-6">
            {(["FORM", "REVIEW"] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                    step === s
                      ? "bg-primary text-primary-content border-primary"
                      : step === "REVIEW" && s === "FORM"
                        ? "bg-success text-success-content border-success"
                        : "border-base-300 text-base-content/40"
                  }`}
                >
                  {i + 1}
                </div>
                <span
                  className={`text-sm ${step === s ? "font-semibold text-primary" : "text-base-content/50"}`}
                >
                  {s === "FORM" ? "Details" : "Review"}
                </span>
                {i < 1 && <span className="text-base-content/30 mx-1">›</span>}
              </div>
            ))}
          </div>
          {step === "FORM" && (
            <form className="space-y-1" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-4">
                {/* Case Details Card */}
                <div className="card rounded-2xl shadow-sm border">
                  <div className="card-body p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="p-2 rounded-md bg-sky-100 text-sky-600">
                        <FiFileText />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold">Case Details</h4>
                        <p className="text-xs text-base-content/60">
                          Case number, branch, and filing date
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <FormField
                        label="Case Number *"
                        htmlFor="case-number"
                        error={formErrors.caseNumber}
                      >
                        <input
                          id="case-number"
                          name="caseNumber"
                          type="text"
                          className={`input input-bordered w-full ${formErrors.caseNumber ? "input-error" : ""}`}
                          placeholder="e.g. SPC-2026-0001"
                          value={formData.caseNumber}
                          onChange={handleChange}
                        />
                      </FormField>

                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          label="Rafled to Branch *"
                          htmlFor="raffled-to-branch"
                          error={formErrors.raffledToBranch}
                        >
                          <input
                            id="raffled-to-branch"
                            name="raffledToBranch"
                            type="text"
                            className={`input input-bordered w-full ${formErrors.raffledToBranch ? "input-error" : ""}`}
                            placeholder="e.g. Branch 1"
                            value={formData.raffledToBranch}
                            onChange={handleChange}
                          />
                        </FormField>

                        <FormField
                          label="Date Filled *"
                          htmlFor="date-filed"
                          error={formErrors.dateFiled}
                        >
                          <input
                            id="date-filed"
                            name="dateFiled"
                            type="date"
                            className={`input input-bordered w-full ${formErrors.dateFiled ? "input-error" : ""}`}
                            value={dateValue}
                            onChange={handleChange}
                          />
                        </FormField>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Petition Details Card */}
                <div className="card rounded-2xl shadow-sm border">
                  <div className="card-body p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="p-2 rounded-md bg-purple-100 text-purple-600">
                        <FiMapPin />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold">
                          Petition Details
                        </h4>
                        <p className="text-xs text-base-content/60">
                          Petitioner information and petition nature
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <FormField
                        label="Petitioners *"
                        htmlFor="petitioners"
                        error={formErrors.petitioners}
                      >
                        <input
                          id="petitioners"
                          name="petitioners"
                          type="text"
                          className={`input input-bordered w-full ${formErrors.petitioners ? "input-error" : ""}`}
                          placeholder="Full name of petitioner(s)"
                          value={formData.petitioners}
                          onChange={handleChange}
                        />
                      </FormField>

                      <FormField
                        label="Title No *"
                        htmlFor="title-no"
                        error={formErrors.titleNo}
                      >
                        <input
                          id="title-no"
                          name="titleNo"
                          type="text"
                          className={`input input-bordered w-full ${formErrors.titleNo ? "input-error" : ""}`}
                          placeholder="e.g. T-12345"
                          value={formData.titleNo}
                          onChange={handleChange}
                        />
                      </FormField>

                      <FormField
                        label="Nature *"
                        htmlFor="nature"
                        error={formErrors.nature}
                      >
                        <textarea
                          id="nature"
                          name="nature"
                          className={`textarea textarea-bordered w-full ${formErrors.nature ? "textarea-error" : ""}`}
                          rows={3}
                          placeholder="e.g. Petition for Adoption"
                          value={formData.nature}
                          onChange={handleChange}
                        />
                      </FormField>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}

          {step === "REVIEW" && (
            <div className="space-y-3">
              <p className="text-sm text-base-content/60 mb-4">
                Please review the details before saving.
              </p>
              {(
                [
                  ["Case Number", formData.caseNumber || "—"],
                  ["Rafled to Branch", formData.raffledToBranch || "—"],
                  ["Date Filled", dateValue],
                  ["Petitioners", formData.petitioners || "—"],
                  ["Title No", formData.titleNo || "—"],
                  ["Nature", formData.nature || "—"],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between items-start py-2 border-b border-base-200 last:border-0"
                >
                  <span className="text-sm text-base-content/60 font-medium w-36 shrink-0">
                    {label}
                  </span>
                  <span className="text-sm font-medium text-right">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-base-300 flex justify-between gap-3">
          {step === "FORM" ? (
            <>
              <button
                type="button"
                className="btn btn-outline"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleReview}
                disabled={
                  !formData.caseNumber ||
                  !formData.raffledToBranch ||
                  !formData.dateFiled ||
                  !formData.petitioners ||
                  !formData.titleNo ||
                  !formData.nature
                }
              >
                Review
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setStep("FORM")}
                disabled={isSubmitting}
              >
                Back
              </button>
              <button
                type="button"
                className={`btn btn-success ${isSubmitting ? "loading" : ""}`}
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? "Saving..."
                  : type === ReceiveDrawerType.ADD
                    ? "Create Entry"
                    : "Save Changes"}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ReceiveDrawer;
