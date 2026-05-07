"use client";

import {
  CRIMINAL_APPEALED_CASE_FIELDS,
  RedirectingUI,
  Roles,
  usePopup,
} from "@rtc-database/shared";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { FiArrowLeft, FiSave } from "react-icons/fi";
import {
  createCriminalAppealedCase,
  getCriminalAppealedCaseById,
  updateCriminalAppealedCase,
} from "./CriminalAppealedActions";

type FormState = Record<string, string>;

const LIST_HREF = "/user/cases/criminal?view=appealed";

const toDateInputValue = (value: unknown): string => {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const createEmptyForm = (): FormState =>
  CRIMINAL_APPEALED_CASE_FIELDS.reduce<FormState>((acc, field) => {
    acc[field.key] = "";
    return acc;
  }, {});

export default function CriminalAppealedFormPage({ role }: { role: Roles }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const popup = usePopup();
  const idParam = searchParams.get("id");
  const recordId = idParam ? Number(idParam) : null;
  const isEditing = Number.isInteger(recordId) && Number(recordId) > 0;
  const canManage = role === Roles.ADMIN || role === Roles.CRIMINAL;
  const [form, setForm] = useState<FormState>(() => createEmptyForm());
  const [loading, setLoading] = useState(Boolean(isEditing));
  const [saving, setSaving] = useState(false);

  const pageTitle = useMemo(
    () => `${isEditing ? "Edit" : "Add"} Criminal Appealed Case`,
    [isEditing],
  );

  useEffect(() => {
    if (!isEditing || !recordId) return;

    const loadRecord = async () => {
      setLoading(true);
      const result = await getCriminalAppealedCaseById(recordId);

      if (!result.success) {
        popup.showError(result.error || "Failed to load record");
        router.push(LIST_HREF);
        return;
      }

      if (!result.result) {
        popup.showError("Failed to load record");
        router.push(LIST_HREF);
        return;
      }

      const raw = result.result as unknown as Record<string, unknown>;
      const next = createEmptyForm();
      CRIMINAL_APPEALED_CASE_FIELDS.forEach((field) => {
        next[field.key] =
          field.type === "date"
            ? toDateInputValue(raw[field.key])
            : String(raw[field.key] ?? "");
      });
      setForm(next);
      setLoading(false);
    };

    void loadRecord();
  }, [isEditing, popup, recordId, router]);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canManage) {
      popup.showError("You do not have permission to save this record.");
      return;
    }

    setSaving(true);
    const result =
      isEditing && recordId
        ? await updateCriminalAppealedCase(recordId, form)
        : await createCriminalAppealedCase(form);
    setSaving(false);

    if (!result.success) {
      popup.showError(result.error || "Failed to save record");
      return;
    }

    popup.showSuccess("Record saved successfully");
    router.push(LIST_HREF);
  };

  if (!canManage) {
    return (
      <div className="alert alert-error">
        <span>You do not have permission to manage this record.</span>
      </div>
    );
  }

  if (loading) {
    return <RedirectingUI titleText="Loading appealed case record..." />;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="card bg-base-100 shadow-xl">
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-base font-bold text-base-content mb-1">
                <span>Cases</span>
                <span className="text-base-content/30">/</span>
                <span className="text-base-content/70 font-medium">
                  Criminal
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-base-content">
                {pageTitle}
              </h1>
            </div>
            <button
              type="button"
              className="btn btn-ghost gap-2"
              onClick={() => router.push(LIST_HREF)}
            >
              <FiArrowLeft className="h-5 w-5" />
              Back
            </button>
          </div>
        </div>
      </header>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="rounded-xl border border-base-200 bg-base-100 p-4 sm:p-6 shadow-lg"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {CRIMINAL_APPEALED_CASE_FIELDS.map((field) => (
            <label key={field.key} className="form-control">
              <span className="label">
                <span className="label-text font-semibold">{field.label}</span>
              </span>
              <input
                type={field.type === "date" ? "date" : "text"}
                className="input input-bordered"
                value={form[field.key] ?? ""}
                onChange={(event) => handleChange(field.key, event.target.value)}
              />
            </label>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => router.push(LIST_HREF)}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`btn btn-primary gap-2 ${saving ? "loading" : ""}`}
            disabled={saving}
          >
            <FiSave className="h-5 w-5" />
            {saving ? "Saving..." : "Save Record"}
          </button>
        </div>
      </form>
    </div>
  );
}
