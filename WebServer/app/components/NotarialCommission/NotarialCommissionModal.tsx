"use client";

import React from "react";
import {
  extractCommissionYears,
  getCommissionYearLabel,
  NotarialCommissionRecord,
} from "./schema";

interface Props {
  showModal: boolean;
  isEdit: boolean;
  form: Partial<NotarialCommissionRecord>;
  errors: Record<string, string>;
  setForm: (form: Partial<NotarialCommissionRecord>) => void;
  setShowModal: (value: boolean) => void;
  handleSave: (event: React.FormEvent) => void;
}

const NotarialCommissionModal: React.FC<Props> = ({
  showModal,
  isEdit,
  form,
  errors,
  setForm,
  setShowModal,
  handleSave,
}) => {
  if (!showModal) return null;

  const years = extractCommissionYears(form.termOfCommission);
  const detectedYear = getCommissionYearLabel(
    years.termStartYear ?? form.termStartYear,
    years.termEndYear ?? form.termEndYear,
  );

  return (
    <div className="fixed inset-0 flex justify-center items-center bg-black/40 z-50 px-4">
      <form
        onSubmit={handleSave}
        className="bg-base-100 w-full max-w-4xl rounded-2xl p-8 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-semibold">
              {isEdit ? "Edit Notarial Commission" : "Add Notarial Commission"}
            </h2>
          </div>
          <div className="badge badge-outline badge-lg">{detectedYear}</div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <label className="label-text font-medium">Petition *</label>
            <input
              className={`input input-bordered w-full ${
                errors.petition ? "input-error" : ""
              }`}
              value={form.petition || ""}
              onChange={(event) =>
                setForm({ ...form, petition: event.target.value })
              }
            />
            {errors.petition && (
              <p className="text-error text-sm mt-1">{errors.petition}</p>
            )}
          </div>

          <div>
            <label className="label-text font-medium">Name *</label>
            <input
              className={`input input-bordered w-full ${
                errors.name ? "input-error" : ""
              }`}
              value={form.name || ""}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
            {errors.name && (
              <p className="text-error text-sm mt-1">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="label-text font-medium">
              Term of Commission *
            </label>
            <input
              className={`input input-bordered w-full ${
                errors.termOfCommission ? "input-error" : ""
              }`}
              value={form.termOfCommission || ""}
              onChange={(event) =>
                setForm({ ...form, termOfCommission: event.target.value })
              }
              placeholder="2022-2023"
            />
            {errors.termOfCommission && (
              <p className="text-error text-sm mt-1">
                {errors.termOfCommission}
              </p>
            )}
          </div>

          <div>
            <label className="label-text font-medium">Address *</label>
            <input
              className={`input input-bordered w-full ${
                errors.address ? "input-error" : ""
              }`}
              value={form.address || ""}
              onChange={(event) =>
                setForm({ ...form, address: event.target.value })
              }
            />
            {errors.address && (
              <p className="text-error text-sm mt-1">{errors.address}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setShowModal(false)}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary px-8">
            {isEdit ? "Update" : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NotarialCommissionModal;
