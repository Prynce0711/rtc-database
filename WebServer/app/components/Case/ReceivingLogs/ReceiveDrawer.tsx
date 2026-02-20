"use client";

import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import { FiFileText, FiX } from "react-icons/fi";
import { usePopup } from "../../Popup/PopupProvider";
import FormField from "../FormField";
import { ReceiveLog } from "./ReceiveRecord";

export enum ReceiveDrawerType {
  ADD = "ADD",
  EDIT = "EDIT",
}

const EMPTY_FORM: Record<string, any> = {
  BookAndPages: "",
  dateReceived: new Date().toISOString().slice(0, 10),
  Abbreviation: "",
  "Case No": "",
  Content: "",
  "Branch No": "",
  Time: "",
  Notes: "",
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
        BookAndPages: selectedLog.BookAndPages ?? selectedLog.receiptNo ?? "",
        dateReceived: selectedLog.dateReceived
          ? String(selectedLog.dateReceived).slice(0, 10)
          : EMPTY_FORM.dateReceived,
        Abbreviation: selectedLog.Abbreviation ?? "",
        "Case No": selectedLog["Case No"] ?? selectedLog.caseNumber ?? "",
        Content: selectedLog.Content ?? "",
        "Branch No": selectedLog["Branch No"] ?? selectedLog.branch ?? "",
        Time: selectedLog.Time ?? selectedLog.timeReceived ?? "",
        Notes: selectedLog.Notes ?? selectedLog.remarks ?? "",
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
    const required = ["BookAndPages", "Case No", "dateReceived"];
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
          ? "Create this receiving log entry?"
          : "Save changes to this receiving log entry?",
      ))
    )
      return;

    setIsSubmitting(true);
    try {
      const payload = {
        id: selectedLog?.id ?? 0,
        BookAndPages: formData.BookAndPages,
        dateReceived: formData.dateReceived,
        Abbreviation: formData.Abbreviation,
        "Case No": formData["Case No"],
        Content: formData.Content,
        "Branch No": formData["Branch No"],
        Time: formData.Time,
        Notes: formData.Notes,
      } as any;

      if (type === ReceiveDrawerType.ADD) {
        onCreate?.(payload);
      } else {
        onUpdate?.(payload);
      }

      statusPopup.showSuccess(
        type === ReceiveDrawerType.ADD
          ? "Receiving log created successfully"
          : "Receiving log updated successfully",
      );
      onClose();
    } catch (err) {
      statusPopup.showError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const dateValue = formData.dateReceived
    ? (formData.dateReceived instanceof Date
        ? formData.dateReceived
        : new Date(String(formData.dateReceived))
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-300">
          <h2 className="text-xl font-bold">
            {type === ReceiveDrawerType.ADD
              ? "New Receiving Log"
              : "Edit Receiving Log"}
          </h2>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <FiX size={18} />
          </button>
        </div>

        <div className="flex gap-2 px-6 pt-4">
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

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === "FORM" && (
            <form className="space-y-1" onSubmit={(e) => e.preventDefault()}>
              <div className="flex items-center gap-2 mb-4">
                <FiFileText className="text-primary" size={20} />
                <h3 className="font-semibold text-base-content">
                  Document Information
                </h3>
              </div>

              <FormField
                label="Book And Pages"
                htmlFor="book-and-pages"
                error={formErrors.BookAndPages}
              >
                <input
                  id="book-and-pages"
                  name="BookAndPages"
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="e.g. OR-2026-00001"
                  value={formData.BookAndPages}
                  onChange={handleChange}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Date Received"
                  htmlFor="date-received"
                  error={formErrors.dateReceived}
                >
                  <input
                    id="date-received"
                    name="dateReceived"
                    type="date"
                    className="input input-bordered w-full"
                    value={dateValue}
                    onChange={handleChange}
                  />
                </FormField>
                <FormField label="Time" htmlFor="time" error={formErrors.Time}>
                  <input
                    id="time"
                    name="Time"
                    type="time"
                    className="input input-bordered w-full"
                    value={formData.Time ?? ""}
                    onChange={handleChange}
                  />
                </FormField>
              </div>

              <FormField
                label="Abbreviation"
                htmlFor="abbreviation"
                error={formErrors.Abbreviation}
              >
                <input
                  id="abbreviation"
                  name="Abbreviation"
                  type="text"
                  className="input input-bordered w-full"
                  value={formData.Abbreviation}
                  onChange={handleChange}
                />
              </FormField>

              <FormField
                label="Case No"
                htmlFor="case-no"
                error={formErrors["Case No"]}
              >
                <input
                  id="case-no"
                  name="Case No"
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="e.g. Crim-2026-0001"
                  value={formData["Case No"]}
                  onChange={handleChange}
                />
              </FormField>

              <FormField
                label="Content"
                htmlFor="content"
                error={formErrors.Content}
              >
                <textarea
                  id="content"
                  name="Content"
                  className="textarea textarea-bordered w-full"
                  rows={3}
                  placeholder="Short description/content"
                  value={formData.Content}
                  onChange={handleChange}
                />
              </FormField>

              <FormField
                label="Branch No"
                htmlFor="branch-no"
                error={formErrors["Branch No"]}
              >
                <input
                  id="branch-no"
                  name="Branch No"
                  type="text"
                  className="input input-bordered w-full"
                  value={formData["Branch No"]}
                  onChange={handleChange}
                />
              </FormField>

              <FormField label="Notes" htmlFor="notes" error={formErrors.Notes}>
                <textarea
                  id="notes"
                  name="Notes"
                  className="textarea textarea-bordered w-full"
                  rows={3}
                  placeholder="Optional notes"
                  value={formData.Notes}
                  onChange={handleChange}
                />
              </FormField>
            </form>
          )}

          {step === "REVIEW" && (
            <div className="space-y-3">
              <p className="text-sm text-base-content/60 mb-4">
                Please review the details before saving.
              </p>
              {(
                [
                  ["Book And Pages", formData.BookAndPages],
                  ["Date Received", dateValue],
                  ["Time", formData.Time || "—"],
                  ["Abbreviation", formData.Abbreviation || "—"],
                  ["Case No", formData["Case No"] || "—"],
                  ["Content", formData.Content || "—"],
                  ["Branch No", formData["Branch No"] || "—"],
                  ["Notes", formData.Notes || "—"],
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

        <div className="px-6 py-4 border-t border-base-300 flex justify-between gap-3">
          {step === "FORM" ? (
            <>
              <button className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleReview}>
                Review
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={() => setStep("FORM")}>
                Back
              </button>
              <button
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
