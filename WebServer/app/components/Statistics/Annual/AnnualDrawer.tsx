"use client";

import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import FormField from "../../Case/FormField";
import { usePopup } from "../../Popup/PopupProvider";
import { FieldConfig } from "./AnnualFieldConfig";

export enum AnnualDrawerType {
  ADD = "ADD",
  EDIT = "EDIT",
}

interface AnnualDrawerProps {
  type: AnnualDrawerType;
  title: string;
  fields: FieldConfig[];
  onClose: () => void;
  selectedRecord?: Record<string, unknown> | null;
  onCreate?: (record: Record<string, unknown>) => void | Promise<void>;
  onUpdate?: (record: Record<string, unknown>) => void | Promise<void>;
}

const buildEmptyForm = (fields: FieldConfig[]): Record<string, string> =>
  Object.fromEntries(
    fields.map((f) => [
      f.name,
      f.type === "date" ? new Date().toISOString().slice(0, 10) : "",
    ]),
  );

const AnnualDrawer = ({
  type,
  title,
  fields,
  onClose,
  selectedRecord = null,
  onCreate,
  onUpdate,
}: AnnualDrawerProps) => {
  const [formData, setFormData] = useState<Record<string, string>>(
    buildEmptyForm(fields),
  );
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const statusPopup = usePopup();

  // Populate form when editing an existing record
  useEffect(() => {
    if (type === AnnualDrawerType.EDIT && selectedRecord) {
      const data: Record<string, string> = {};
      fields.forEach((f) => {
        let val = String(selectedRecord[f.name] ?? "");
        if (f.type === "date" && val) val = val.slice(0, 10);
        data[f.name] = val;
      });
      setFormData(data);
    } else {
      setFormData(buildEmptyForm(fields));
    }
    setFormErrors({});
  }, [type, selectedRecord, fields]);

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

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    fields.forEach((f) => {
      if (f.required && !formData[f.name]?.trim()) {
        errs[f.name] = "This field is required";
      }
    });
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }
    setIsSubmitting(true);
    try {
      if (type === AnnualDrawerType.ADD) {
        await onCreate?.({ ...formData });
        statusPopup.showSuccess("Entry added successfully");
      } else {
        await onUpdate?.({ ...selectedRecord, ...formData });
        statusPopup.showSuccess("Entry updated successfully");
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderInput = (field: FieldConfig) => {
    if (field.type === "textarea") {
      return (
        <textarea
          name={field.name}
          className="textarea textarea-bordered w-full"
          value={formData[field.name] ?? ""}
          onChange={handleChange}
          placeholder={field.placeholder}
          rows={3}
        />
      );
    }
    if (field.type === "select" && field.options) {
      return (
        <select
          name={field.name}
          className="select select-bordered w-full"
          value={formData[field.name] ?? ""}
          onChange={handleChange}
        >
          <option value="">Select…</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        type={field.type}
        name={field.name}
        className="input input-bordered w-full"
        value={formData[field.name] ?? ""}
        onChange={handleChange}
        placeholder={field.placeholder}
      />
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        className="fixed inset-0 bg-black/40 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <motion.div
        key="drawer"
        className="fixed right-0 top-0 h-full w-full max-w-lg bg-base-100 shadow-2xl z-50 flex flex-col"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        <div className="flex items-center justify-between p-6 border-b border-base-200">
          <h2 className="text-xl font-bold text-base-content">
            {type === AnnualDrawerType.ADD
              ? `Add ${title} Entry`
              : `Edit ${title} Entry`}
          </h2>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <FiX size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-y-4">
            {fields.map((field) => (
              <FormField
                key={field.name}
                label={
                  <>
                    {field.label}
                    {field.required && (
                      <span className="text-error ml-1">*</span>
                    )}
                  </>
                }
                htmlFor={field.name}
                error={formErrors[field.name]}
              >
                {renderInput(field)}
              </FormField>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-base-200 flex gap-3 justify-end">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn btn-primary ${isSubmitting ? "loading" : ""}`}
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {type === AnnualDrawerType.ADD ? "Add Entry" : "Save Changes"}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AnnualDrawer;
