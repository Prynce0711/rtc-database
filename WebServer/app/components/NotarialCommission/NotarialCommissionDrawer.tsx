"use client";

import { buildGarageProxyUrl } from "@/app/lib/garageProxy";
import { FileViewerModal, usePopup } from "@rtc-database/shared";
import { AnimatePresence, motion } from "framer-motion";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiCopy,
  FiEdit3,
  FiEye,
  FiFileText,
  FiImage,
  FiMapPin,
  FiPlus,
  FiSave,
  FiTrash2,
  FiUpload,
  FiUser,
} from "react-icons/fi";
import {
  createNotarialCommission,
  deleteNotarialCommission,
  doesNotarialCommissionExist,
  updateNotarialCommission,
} from "./NotarialCommissionActions";
import {
  buildNotarialCommissionKey,
  extractCommissionYears,
  getCommissionYearLabel,
  normalizeCommissionText,
  normalizePetitionNumber,
} from "./schema";
import type { NotarialCommissionRecord } from "./schema";

export enum NotarialCommissionDrawerType {
  ADD = "ADD",
  EDIT = "EDIT",
}

type Step = "entry" | "review";

interface EntryForm {
  id: string;
  petition: string;
  name: string;
  termOfCommission: string;
  address: string;
  imageFile: File | null;
  imagePreviewUrl: string;
  errors: Record<string, string>;
}

type ColDef = {
  key: keyof Omit<EntryForm, "id" | "errors">;
  label: string;
  placeholder: string;
  width: number;
  required?: boolean;
  mono?: boolean;
  type?: "text" | "image";
};

const uid = () => Math.random().toString(36).slice(2, 9);

const emptyEntry = (id: string): EntryForm => ({
  id,
  petition: "",
  name: "",
  termOfCommission: "",
  address: "",
  imageFile: null,
  imagePreviewUrl: "",
  errors: {},
});

const getRecordImagePreviewUrl = (
  record: Partial<NotarialCommissionRecord>,
): string =>
  record.imageFile?.key
    ? buildGarageProxyUrl({
        bucket: "rtc-bucket",
        key: record.imageFile.key,
        fileName: record.imageFile.fileName,
        inline: true,
        contentType: record.imageFile.mimeType,
      })
    : "";

const recordToEntry = (
  record: Partial<NotarialCommissionRecord>,
): EntryForm => ({
  id: uid(),
  petition: record.petition ?? "",
  name: record.name ?? "",
  termOfCommission: record.termOfCommission ?? "",
  address: record.address ?? "",
  imageFile: null,
  imagePreviewUrl: getRecordImagePreviewUrl(record),
  errors: {},
});

const REQUIRED_FIELDS = ["name", "termOfCommission", "address"] as const;

const FROZEN_COLS: ColDef[] = [
  {
    key: "petition",
    label: "Petition No.",
    placeholder: "PNC-119-MB-2024",
    width: 210,
    mono: true,
  },
  {
    key: "name",
    label: "Name",
    placeholder: "ABAD, MELVIN J.",
    width: 260,
    required: true,
  },
  {
    key: "imageFile",
    label: "Photo",
    placeholder: "",
    width: 170,
    type: "image",
  },
];

const COMMISSION_COLS: ColDef[] = [
  {
    key: "termOfCommission",
    label: "Term of Commission",
    placeholder: "JAN. 13, 2025-DEC. 31, 2026",
    width: 260,
    required: true,
    mono: true,
  },
  {
    key: "address",
    label: "Address",
    placeholder: "Office address and contact number",
    width: 560,
    required: true,
  },
];

const TABS = [
  {
    key: "commission",
    label: "Commission Details",
    icon: <FiFileText size={13} />,
    cols: COMMISSION_COLS,
  },
] as const;

const IMAGE_ACCEPT = "image/*";

const revokePreviewUrl = (url?: string) => {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
};

function validateEntry(entry: EntryForm): Record<string, string> {
  const errors: Record<string, string> = {};
  REQUIRED_FIELDS.forEach((field) => {
    if (!entry[field] || String(entry[field]).trim() === "") {
      errors[field] = "Required";
    }
  });

  if (
    entry.termOfCommission.trim() &&
    !extractCommissionYears(entry.termOfCommission).termStartYear
  ) {
    errors.termOfCommission = "Include a valid year or year range";
  }

  return errors;
}

const CellInput = ({
  col,
  value,
  error,
  onChange,
  onKeyDown,
}: {
  col: ColDef;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <input
        type="text"
        value={value}
        placeholder={col.placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        title={error || col.label}
        className={`xls-input${error ? " xls-input-err" : ""}${col.mono ? " xls-mono" : ""}`}
      />
      {error && (
        <span className="xls-cell-err">
          <FiAlertCircle size={10} />
          {error}
        </span>
      )}
    </div>
  );
};

const ImageCell = ({
  entry,
  onSelectFile,
  onPreview,
  onClear,
}: {
  entry: EntryForm;
  onSelectFile: (file: File | null) => void;
  onPreview: () => void;
  onClear: () => void;
}) => {
  const hasImage = Boolean(entry.imagePreviewUrl);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="btn btn-xs btn-outline gap-1.5">
          <FiUpload size={12} />
          {hasImage ? "Replace" : "Upload"}
          <input
            type="file"
            accept={IMAGE_ACCEPT}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              onSelectFile(file);
              event.target.value = "";
            }}
          />
        </label>
        {hasImage && (
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={onClear}
          >
            Remove
          </button>
        )}
      </div>
      <button
        type="button"
        className="flex items-center gap-2 text-left"
        onClick={hasImage ? onPreview : undefined}
        disabled={!hasImage}
      >
        {hasImage ? (
          <img
            src={entry.imagePreviewUrl}
            alt="Commission"
            className="h-10 w-10 rounded-lg border border-base-300 object-cover"
          />
        ) : (
          <span className="text-xs text-base-content/40 inline-flex items-center gap-1">
            <FiImage size={12} />
            No image
          </span>
        )}
      </button>
    </div>
  );
};

function ReviewCard({
  entry,
  isExistingRecord,
  onViewImage,
}: {
  entry: EntryForm;
  isExistingRecord: boolean;
  onViewImage?: () => void;
}) {
  const years = extractCommissionYears(entry.termOfCommission);
  const yearLabel = getCommissionYearLabel(
    years.termStartYear,
    years.termEndYear,
  );

  return (
    <div className="rv-card">
      {isExistingRecord && (
        <div className="alert alert-warning mb-4">
          <span>This notarial commission already exists</span>
        </div>
      )}

      <div className="rv-hero">
        <div className="rv-hero-left">
          <div className="rv-hero-casenum">
            {entry.petition ? (
              <span style={{ opacity: 0.6 }}>{entry.petition}</span>
            ) : (
              <span style={{ opacity: 0.4 }}>No petition number</span>
            )}
          </div>
          <div className="rv-hero-name">
            {entry.name || (
              <span style={{ opacity: 0.4, fontSize: 18 }}>
                No name entered
              </span>
            )}
          </div>
          {entry.termOfCommission && (
            <div className="rv-hero-charge">{entry.termOfCommission}</div>
          )}
        </div>
        <div className="rv-hero-badges">
          <span className="rv-badge rv-badge-court">{yearLabel}</span>
        </div>
      </div>

      <div className="rv-body">
        <div className="rv-body-main">
          <div className="rv-section">
            <div className="rv-section-header">
              <FiUser size={13} />
              <span>Commission Record</span>
            </div>
            <div className="rv-grid rv-grid-3">
              {[
                { label: "Petition Number", value: entry.petition, mono: true },
                { label: "Name", value: entry.name },
                {
                  label: "Term of Commission",
                  value: entry.termOfCommission,
                  mono: true,
                },
                { label: "Detected Year", value: yearLabel, mono: true },
              ].map(({ label, value, mono }) => (
                <div className="rv-field" key={label}>
                  <div className="rv-field-label">{label}</div>
                  <div className={`rv-field-value${mono ? " rv-mono" : ""}`}>
                    {value || <span className="rv-empty">-</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rv-section">
            <div className="rv-section-header">
              <FiMapPin size={13} />
              <span>Address</span>
            </div>
            <div className="rv-field">
              <div className="rv-field-value">
                {entry.address || <span className="rv-empty">-</span>}
              </div>
            </div>
          </div>

          {entry.imagePreviewUrl && (
            <div className="rv-section">
              <div className="rv-section-header">
                <FiImage size={13} />
                <span>Photo</span>
              </div>
              <button
                type="button"
                className="flex items-center gap-3"
                onClick={onViewImage}
              >
                <img
                  src={entry.imagePreviewUrl}
                  alt={entry.name || "Commission"}
                  className="h-16 w-16 rounded-xl border border-base-300 object-cover"
                />
                <span className="text-sm font-semibold text-base-content/70">
                  View image
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const NotarialCommissionDrawer = ({
  type,
  onClose,
  selectedRecord = null,
  selectedRecords,
  onCreate,
  onUpdate,
}: {
  type: NotarialCommissionDrawerType;
  onClose: () => void;
  selectedRecord?: NotarialCommissionRecord | null;
  selectedRecords?: NotarialCommissionRecord[];
  onCreate?: (record: NotarialCommissionRecord) => void;
  onUpdate?: (record: NotarialCommissionRecord) => void;
}) => {
  const isEdit = type === NotarialCommissionDrawerType.EDIT;
  const editRecords =
    selectedRecords && selectedRecords.length > 0
      ? selectedRecords
      : selectedRecord
        ? [selectedRecord]
        : [];
  const statusPopup = usePopup();
  const tableRef = useRef<HTMLDivElement>(null);
  const entriesRef = useRef<EntryForm[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("entry");
  const [activeTab, setActiveTab] =
    useState<(typeof TABS)[number]["key"]>("commission");
  const [reviewIdx, setReviewIdx] = useState(0);
  const [existingRecordKeys, setExistingRecordKeys] = useState<string[]>([]);
  const [imageViewer, setImageViewer] = useState({
    open: false,
    url: "",
    title: "",
  });
  const [entries, setEntries] = useState<EntryForm[]>(() =>
    isEdit && editRecords.length > 0
      ? editRecords.map(recordToEntry)
      : [emptyEntry(uid())],
  );

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    return () => {
      entriesRef.current.forEach((entry) =>
        revokePreviewUrl(entry.imagePreviewUrl),
      );
    };
  }, []);

  useEffect(() => {
    setStep("entry");
    setActiveTab("commission");
    setReviewIdx(0);
    setExistingRecordKeys([]);

    if (isEdit && editRecords.length > 0) {
      setEntries(editRecords.map(recordToEntry));
      return;
    }

    setEntries([emptyEntry(uid())]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, selectedRecord, selectedRecords, isEdit]);

  const handleChange = (
    id: string,
    field: keyof Omit<EntryForm, "id" | "errors">,
    value: string,
  ) => {
    const normalizedValue =
      field === "petition" ? normalizePetitionNumber(value) : value;
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              [field]: normalizedValue,
              errors: { ...entry.errors, [field]: "" },
            }
          : entry,
      ),
    );
  };

  const closeImageViewer = () =>
    setImageViewer({ open: false, url: "", title: "" });

  const openImageViewer = (entry: EntryForm) => {
    if (!entry.imagePreviewUrl) return;
    setImageViewer({
      open: true,
      url: entry.imagePreviewUrl,
      title: entry.name || "Commission image",
    });
  };

  const handleImageChange = (id: string, file: File | null) => {
    const existing = entries.find((entry) => entry.id === id);
    if (existing?.imagePreviewUrl) {
      revokePreviewUrl(existing.imagePreviewUrl);
      if (imageViewer.url === existing.imagePreviewUrl) {
        closeImageViewer();
      }
    }

    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== id) return entry;
        return {
          ...entry,
          imageFile: file,
          imagePreviewUrl: file ? URL.createObjectURL(file) : "",
        };
      }),
    );
  };

  const handleAddEntry = useCallback(() => {
    setEntries((prev) => [...prev, emptyEntry(uid())]);
    setTimeout(() => {
      tableRef.current?.scrollTo({
        top: tableRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 60);
  }, []);

  const handleClearTable = useCallback(async () => {
    const label =
      entries.length === 1
        ? "Clear the table and reset the current row?"
        : `Clear all ${entries.length} rows and start over?`;

    if (!(await statusPopup.showConfirm(label))) return;

    entries.forEach((entry) => revokePreviewUrl(entry.imagePreviewUrl));
    setImageViewer({ open: false, url: "", title: "" });

    setEntries([emptyEntry(uid())]);
    setExistingRecordKeys([]);
  }, [entries, statusPopup]);

  const handleRemove = (id: string) =>
    setEntries((prev) => {
      const target = prev.find((entry) => entry.id === id);
      if (target?.imagePreviewUrl) {
        revokePreviewUrl(target.imagePreviewUrl);
        if (imageViewer.url === target.imagePreviewUrl) {
          closeImageViewer();
        }
      }
      return prev.filter((entry) => entry.id !== id);
    });

  const handleDuplicate = (id: string) => {
    const source = entries.find((entry) => entry.id === id);
    if (!source) return;

    const duplicate: EntryForm = {
      ...source,
      id: uid(),
      petition: "",
      name: "",
      imageFile: null,
      imagePreviewUrl: "",
      errors: {},
    };

    setEntries((prev) => {
      const index = prev.findIndex((entry) => entry.id === id);
      const next = [...prev];
      next.splice(index + 1, 0, duplicate);
      return next;
    });
  };

  const activeCols = TABS.find((tab) => tab.key === activeTab)!.cols;
  const isLastTab = true;

  const handleCellKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    entryId: string,
    isLastCol: boolean,
    isLastTabFlag: boolean,
  ) => {
    if (event.key !== "Tab" || event.shiftKey || !isLastCol || !isLastTabFlag) {
      return;
    }

    const isLastRow = entries[entries.length - 1]?.id === entryId;
    if (isLastRow && !isEdit) {
      event.preventDefault();
      handleAddEntry();
      setTimeout(() => {
        const rows = tableRef.current?.querySelectorAll("[data-row]");
        const lastRow = rows?.[rows.length - 1];
        (lastRow?.querySelector("input") as HTMLInputElement | null)?.focus();
      }, 80);
    }
  };

  const completedCount = entries.filter((entry) =>
    REQUIRED_FIELDS.every(
      (field) => normalizeCommissionText(entry[field]).length > 0,
    ),
  ).length;
  const incompleteCount = entries.length - completedCount;

  const buildEntryKey = (entry: EntryForm) =>
    buildNotarialCommissionKey({
      petition: entry.petition,
      name: entry.name,
      termOfCommission: entry.termOfCommission,
      address: entry.address,
    });

  const isExistingRecord = useCallback(
    (entry: EntryForm) => {
      if (isEdit) return false;
      const key = buildEntryKey(entry);
      return key.split("|").slice(1).every(Boolean)
        ? existingRecordKeys.includes(key)
        : false;
    },
    [existingRecordKeys, isEdit],
  );

  const existingRecordRowCount = entries.filter(isExistingRecord).length;

  const refreshExistingRecords = useCallback(async (): Promise<string[]> => {
    if (isEdit) {
      setExistingRecordKeys([]);
      return [];
    }

    const candidates = entries
      .map((entry) => ({
        petition: normalizePetitionNumber(entry.petition),
        name: normalizeCommissionText(entry.name),
        termOfCommission: normalizeCommissionText(entry.termOfCommission),
        address: normalizeCommissionText(entry.address),
      }))
      .filter(
        (entry) =>
          entry.name.length > 0 &&
          entry.termOfCommission.length > 0 &&
          entry.address.length > 0,
      );

    if (candidates.length === 0) {
      setExistingRecordKeys([]);
      return [];
    }

    const result = await doesNotarialCommissionExist(candidates);
    if (!result.success || !result.result) {
      setExistingRecordKeys([]);
      return [];
    }

    setExistingRecordKeys(result.result);
    return result.result;
  }, [entries, isEdit]);

  useEffect(() => {
    if (isEdit) {
      setExistingRecordKeys([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshExistingRecords();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [entries, isEdit, refreshExistingRecords]);

  const handleGoToReview = async () => {
    let anyError = false;
    const validated = entries.map((entry) => {
      const errors = validateEntry(entry);
      if (Object.keys(errors).length > 0) {
        anyError = true;
        return { ...entry, errors };
      }
      return entry;
    });

    setEntries(validated);
    if (anyError) {
      statusPopup.showError("Please fill in all required fields.");
      return;
    }

    await refreshExistingRecords();
    setReviewIdx(0);
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    const existingRecords = await refreshExistingRecords();

    if (!isEdit && existingRecords.length > 0) {
      const label =
        existingRecords.length === 1
          ? "This notarial commission already exists. Continue anyway?"
          : `${existingRecords.length} notarial commission records already exist. Continue anyway?`;

      if (!(await statusPopup.showConfirm(label))) return;
    }

    const confirmLabel = isEdit
      ? entries.length === 1
        ? "Save changes to this notarial commission?"
        : `Save changes to ${entries.length} notarial commissions?`
      : entries.length === 1
        ? "Create this notarial commission?"
        : `Create ${entries.length} notarial commissions?`;

    if (!(await statusPopup.showConfirm(confirmLabel))) return;

    setIsSubmitting(true);
    statusPopup.showLoading(
      isEdit
        ? "Updating notarial commission..."
        : "Creating notarial commission record(s)...",
    );

    const rollbackCreatedRecords = async (
      createdIds: number[],
    ): Promise<string[]> => {
      if (createdIds.length === 0) return [];

      const rollbackResults = await Promise.allSettled(
        createdIds.map((id) => deleteNotarialCommission(id)),
      );

      return rollbackResults.flatMap((result, index) => {
        if (result.status === "rejected") {
          return [`Rollback failed for record ID ${createdIds[index]}`];
        }
        if (!result.value.success) {
          const rollbackMessage =
            result.value.error ?? "Unknown rollback error";
          return [
            `Rollback failed for record ID ${createdIds[index]}: ${rollbackMessage}`,
          ];
        }
        return [];
      });
    };

    try {
      const payloads = entries.map((entry) => {
        const years = extractCommissionYears(entry.termOfCommission);
        return {
          petition: normalizePetitionNumber(entry.petition),
          name: normalizeCommissionText(entry.name),
          termOfCommission: normalizeCommissionText(entry.termOfCommission),
          address: normalizeCommissionText(entry.address),
          termStartYear: years.termStartYear ?? null,
          termEndYear: years.termEndYear ?? null,
          imageFile: entry.imageFile ?? undefined,
        };
      });

      if (isEdit) {
        if (entries.length !== editRecords.length) {
          statusPopup.showError("Record row count mismatch. Please reload.");
          return;
        }

        for (let index = 0; index < payloads.length; index += 1) {
          const target = editRecords[index];
          if (!target?.id) {
            statusPopup.showError(`Record id is missing for row ${index + 1}`);
            return;
          }

          const result = await updateNotarialCommission(
            target.id,
            payloads[index],
          );
          if (!result.success) {
            statusPopup.showError(
              result.error ?? `Update failed for row ${index + 1}`,
            );
            return;
          }
          if (!result.result) {
            statusPopup.showError(`Update failed for row ${index + 1}`);
            return;
          }
          onUpdate?.(result.result as NotarialCommissionRecord);
        }

        statusPopup.showSuccess(
          payloads.length === 1
            ? "Notarial commission updated successfully"
            : `${payloads.length} notarial commissions updated successfully`,
        );
      } else {
        const createdIds: number[] = [];
        const createdRecords: NotarialCommissionRecord[] = [];

        for (let index = 0; index < payloads.length; index += 1) {
          const result = await createNotarialCommission(payloads[index]);
          if (!result.success) {
            const rollbackErrors = await rollbackCreatedRecords(createdIds);
            setStep("entry");
            statusPopup.showError(
              [
                `Failed to create row ${index + 1}: ${result.error ?? "Create failed"}.`,
                rollbackErrors.length > 0
                  ? `Rollback issues: ${rollbackErrors.join(" | ")}`
                  : "Any created rows in this batch were rolled back.",
              ].join(" "),
            );
            return;
          }
          if (!result.result) {
            const rollbackErrors = await rollbackCreatedRecords(createdIds);
            setStep("entry");
            statusPopup.showError(
              [
                `Failed to create row ${index + 1}: Create failed.`,
                rollbackErrors.length > 0
                  ? `Rollback issues: ${rollbackErrors.join(" | ")}`
                  : "Any created rows in this batch were rolled back.",
              ].join(" "),
            );
            return;
          }

          createdIds.push(result.result.id);
          createdRecords.push(result.result as NotarialCommissionRecord);
          onCreate?.(result.result as NotarialCommissionRecord);
        }

        statusPopup.showSuccess(
          createdRecords.length === 1
            ? "Notarial commission created successfully"
            : `${createdRecords.length} notarial commissions created successfully`,
        );
      }

      onClose();
    } catch (error) {
      statusPopup.showError(
        error instanceof Error
          ? error.message
          : "An error occurred. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const ROW_NUM_W = 48;
  const ACTION_W = 72;

  return (
    <div className="xls-root">
      <FileViewerModal
        open={imageViewer.open}
        loading={false}
        url={imageViewer.url}
        type="image"
        title={imageViewer.title}
        error=""
        onClose={closeImageViewer}
      />
      <div className="bg-base-100 xls-topbar">
        <div className="xls-topbar-left">
          <button
            className="xls-back-btn"
            onClick={step === "review" ? () => setStep("entry") : onClose}
            title="Back"
          >
            <FiArrowLeft size={16} />
          </button>
          <nav className="xls-breadcrumb">
            <span>Notarial Commission</span>
            <FiChevronRight size={12} className="xls-breadcrumb-sep" />
            <span className="xls-breadcrumb-current">
              {isEdit
                ? entries.length === 1
                  ? "Edit Record"
                  : "Edit Records"
                : "New Records"}
            </span>
            {step === "review" && (
              <>
                <FiChevronRight size={12} className="xls-breadcrumb-sep" />
                <span className="xls-breadcrumb-current">Review</span>
              </>
            )}
          </nav>
        </div>

        <div className="xls-topbar-right">
          <div className="xls-stepper">
            <div className={`xls-step ${step === "entry" ? "active" : "done"}`}>
              <span className="xls-step-dot">
                {step === "review" ? (
                  <FiCheck size={10} strokeWidth={3} />
                ) : (
                  <FiEdit3 size={10} />
                )}
              </span>
              Data Entry
            </div>
            <div className={`xls-step ${step === "review" ? "active" : ""}`}>
              <span className="xls-step-dot">
                <FiEye size={10} />
              </span>
              Review
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === "entry" ? (
          <motion.div
            key="entry"
            className="bg-base-100 xls-main"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <div className="xls-title-row">
              <div>
                <h1 className="text-5xl xls-title">
                  {isEdit
                    ? entries.length === 1
                      ? "Edit Notarial Commission"
                      : "Edit Notarial Commissions"
                    : "New Notarial Commission"}
                </h1>
                <p className="text-lg mb-9 xls-subtitle">
                  {isEdit ? (
                    "Update commission details. Required fields are marked *."
                  ) : (
                    <>
                      Fill rows like a spreadsheet, then review before saving.
                    </>
                  )}
                </p>
                {!isEdit && (
                  <div
                    className="xls-pills"
                    style={{
                      marginTop: 10,
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span className="xls-pill xls-pill-neutral">
                      <span className="xls-pill-dot" />
                      {entries.length} {entries.length === 1 ? "row" : "rows"}
                    </span>
                    <span
                      className={`xls-pill ${completedCount > 0 ? "xls-pill-ok" : "xls-pill-neutral"}`}
                    >
                      <span className="xls-pill-dot" />
                      {completedCount} complete
                    </span>
                    {existingRecordRowCount > 0 && (
                      <span
                        className="xls-pill"
                        style={{
                          background: "#fef3c7",
                          color: "#78350f",
                          borderColor: "#fbbf24",
                        }}
                        title="Notarial commission already exists"
                      >
                        <span className="xls-pill-dot" />
                        {existingRecordRowCount} existing
                      </span>
                    )}
                    {incompleteCount > 0 && (
                      <span className="xls-pill xls-pill-err">
                        <span className="xls-pill-dot" />
                        {incompleteCount} incomplete
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {!isEdit && (
              <div className="xls-progress">
                <div
                  className="xls-progress-fill"
                  style={{
                    width: `${entries.length ? (completedCount / entries.length) * 100 : 0}%`,
                  }}
                />
              </div>
            )}

            <div className="xls-sheet-wrap">
              <div className="xls-tab-bar">
                {TABS.map((tab) => (
                  <button
                    key={tab.key}
                    className={`xls-tab ${activeTab === tab.key ? "active" : ""}`}
                    onClick={() => setActiveTab(tab.key)}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
                {!isEdit && (
                  <button
                    type="button"
                    className="xls-btn xls-btn-ghost"
                    onClick={() => void handleClearTable()}
                    style={{ marginLeft: "auto" }}
                  >
                    <FiTrash2 size={14} />
                    Clear Table
                  </button>
                )}
              </div>

              <div className="xls-table-outer" ref={tableRef}>
                <table className="xls-table">
                  <colgroup>
                    <col style={{ width: ROW_NUM_W }} />
                    {FROZEN_COLS.map((col) => (
                      <col key={col.key} style={{ width: col.width }} />
                    ))}
                    {activeCols.map((col) => (
                      <col key={col.key} style={{ width: col.width }} />
                    ))}
                    <col style={{ width: ACTION_W }} />
                  </colgroup>

                  <thead>
                    <tr className="xls-thead-group">
                      <th style={{ width: ROW_NUM_W }} />
                      <th colSpan={FROZEN_COLS.length}>
                        <div className="xls-group-label">Identity</div>
                      </th>
                      <th colSpan={activeCols.length}>
                        <div className="xls-group-label">
                          {TABS.find((tab) => tab.key === activeTab)?.label}
                        </div>
                      </th>
                      <th />
                    </tr>
                    <tr className="xls-thead-cols">
                      <th style={{ textAlign: "center" }}>#</th>
                      {FROZEN_COLS.map((col) => (
                        <th
                          key={col.key}
                          className={col.required ? "req-col" : ""}
                        >
                          {col.label}
                        </th>
                      ))}
                      {activeCols.map((col) => (
                        <th
                          key={col.key}
                          className={col.required ? "req-col" : ""}
                        >
                          {col.label}
                        </th>
                      ))}
                      <th />
                    </tr>
                  </thead>

                  <tbody>
                    <AnimatePresence initial={false}>
                      {entries.map((entry, rowIdx) => {
                        const lastColIdx = activeCols.length - 1;
                        const rowHasExistingRecord = isExistingRecord(entry);

                        return (
                          <motion.tr
                            key={entry.id}
                            data-row
                            layout
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                            transition={{ duration: 0.12 }}
                            className={`xls-row ${rowHasExistingRecord ? "bg-yellow-100/60 hover:bg-yellow-100" : ""}`}
                            title={
                              rowHasExistingRecord
                                ? "Notarial commission already exists"
                                : undefined
                            }
                          >
                            <td className="td-num">
                              <span className="xls-rownum">{rowIdx + 1}</span>
                            </td>

                            {FROZEN_COLS.map((col) => (
                              <td key={col.key}>
                                {col.type === "image" ? (
                                  <ImageCell
                                    entry={entry}
                                    onSelectFile={(file) =>
                                      handleImageChange(entry.id, file)
                                    }
                                    onPreview={() => openImageViewer(entry)}
                                    onClear={() =>
                                      handleImageChange(entry.id, null)
                                    }
                                  />
                                ) : (
                                  <CellInput
                                    col={col}
                                    value={String(entry[col.key] ?? "")}
                                    error={entry.errors[col.key]}
                                    onChange={(value) =>
                                      handleChange(entry.id, col.key, value)
                                    }
                                  />
                                )}
                              </td>
                            ))}

                            {activeCols.map((col, colIdx) => (
                              <td key={col.key}>
                                {col.type === "image" ? (
                                  <ImageCell
                                    entry={entry}
                                    onSelectFile={(file) =>
                                      handleImageChange(entry.id, file)
                                    }
                                    onPreview={() => openImageViewer(entry)}
                                    onClear={() =>
                                      handleImageChange(entry.id, null)
                                    }
                                  />
                                ) : (
                                  <CellInput
                                    col={col}
                                    value={String(entry[col.key] ?? "")}
                                    error={entry.errors[col.key]}
                                    onChange={(value) =>
                                      handleChange(entry.id, col.key, value)
                                    }
                                    onKeyDown={(event) =>
                                      handleCellKeyDown(
                                        event,
                                        entry.id,
                                        colIdx === lastColIdx,
                                        isLastTab,
                                      )
                                    }
                                  />
                                )}
                              </td>
                            ))}

                            <td className="td-actions">
                              <div className="xls-row-actions">
                                <button
                                  type="button"
                                  className="xls-row-btn"
                                  onClick={() => handleDuplicate(entry.id)}
                                  title="Duplicate row"
                                >
                                  <FiCopy size={13} />
                                </button>
                                {entries.length > 1 && (
                                  <button
                                    type="button"
                                    className="xls-row-btn del"
                                    onClick={() => handleRemove(entry.id)}
                                    title="Remove row"
                                  >
                                    <FiTrash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>

              {!isEdit && (
                <button
                  type="button"
                  className="xls-add-row"
                  onClick={handleAddEntry}
                >
                  <FiPlus size={14} strokeWidth={2.5} />
                  Add Row
                </button>
              )}
            </div>

            <div className="xls-footer">
              <div className="xls-footer-meta">
                {!isEdit && entries.length > 1 && (
                  <span>
                    <strong>{completedCount}</strong> of{" "}
                    <strong>{entries.length}</strong> rows ready
                  </span>
                )}
                <span style={{ color: "var(--color-subtle)", fontSize: 13 }}>
                  Fields marked{" "}
                  <span style={{ color: "var(--color-error)" }}>*</span> are
                  required
                </span>
              </div>
              <div className="xls-footer-right">
                <button className="xls-btn xls-btn-ghost" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="xls-btn xls-btn-primary"
                  onClick={handleGoToReview}
                >
                  <FiEye size={15} />
                  Review
                  {!isEdit && entries.length > 1 ? ` (${entries.length})` : ""}
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="review"
            className="xls-main"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <div className="rv-summary">
              <div className="rv-summary-left">
                <div className="rv-summary-icon">
                  <FiCheck size={17} strokeWidth={2.5} />
                </div>
                <div>
                  <p className="rv-summary-title">
                    {isEdit
                      ? "Review your edits"
                      : entries.length === 1
                        ? "Review before saving"
                        : `Review ${entries.length} notarial commissions before saving`}
                  </p>
                  <p className="rv-summary-sub">
                    {isEdit
                      ? "Check the details below, then confirm your changes."
                      : "All fields validated. Confirm the details are correct."}
                  </p>
                  {!isEdit && existingRecordRowCount > 0 && (
                    <p className="text-sm font-semibold text-warning mt-2">
                      {existingRecordRowCount} row
                      {existingRecordRowCount > 1 ? "s" : ""} already exist.
                    </p>
                  )}
                </div>
              </div>
              <button
                className="xls-btn xls-btn-outline"
                onClick={() => setStep("entry")}
              >
                <FiEdit3 size={14} />
                Go Back & Edit
              </button>
            </div>

            <div className="rv-layout">
              {entries.length > 1 && (
                <div className="rv-sidebar">
                  <div className="rv-sidebar-head">
                    {entries.length} Records
                  </div>
                  <div className="rv-sidebar-list">
                    {entries.map((entry, index) => {
                      const rowHasExistingRecord = isExistingRecord(entry);
                      return (
                        <button
                          key={entry.id}
                          className={`rv-sidebar-item${reviewIdx === index ? " active" : ""}${rowHasExistingRecord ? " bg-yellow-100/60" : ""}`}
                          onClick={() => setReviewIdx(index)}
                          title={
                            rowHasExistingRecord
                              ? "Notarial commission already exists"
                              : undefined
                          }
                        >
                          <span className="rv-sidebar-num">{index + 1}</span>
                          <div className="rv-sidebar-info">
                            <div className="rv-sidebar-casenum">
                              {entry.name || "No name"}
                            </div>
                            <div className="rv-sidebar-name">
                              {entry.petition || entry.termOfCommission}
                            </div>
                            {rowHasExistingRecord && (
                              <div className="text-xs text-warning font-semibold">
                                Already exists
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="rv-panel">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={reviewIdx}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.12 }}
                  >
                    <ReviewCard
                      entry={entries[reviewIdx]}
                      isExistingRecord={isExistingRecord(entries[reviewIdx])}
                      onViewImage={() => openImageViewer(entries[reviewIdx])}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="xls-footer">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  className="xls-btn xls-btn-ghost"
                  onClick={() => setStep("entry")}
                >
                  <FiArrowLeft size={14} />
                  Back to Edit
                </button>
                {entries.length > 1 && (
                  <div className="rv-pager">
                    <button
                      className="xls-btn-icon"
                      onClick={() =>
                        setReviewIdx((idx) => Math.max(0, idx - 1))
                      }
                      disabled={reviewIdx === 0}
                    >
                      <FiChevronLeft size={15} />
                    </button>
                    <span className="rv-pager-info">
                      {reviewIdx + 1} / {entries.length}
                    </span>
                    <button
                      className="xls-btn-icon"
                      onClick={() =>
                        setReviewIdx((idx) =>
                          Math.min(entries.length - 1, idx + 1),
                        )
                      }
                      disabled={reviewIdx === entries.length - 1}
                    >
                      <FiChevronRight size={15} />
                    </button>
                  </div>
                )}
              </div>
              <button
                className="xls-btn xls-btn-success"
                style={{
                  height: 50,
                  paddingLeft: 30,
                  paddingRight: 30,
                  fontSize: 16,
                }}
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="xls-spinner" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FiSave size={17} />
                    {isEdit
                      ? "Save Changes"
                      : entries.length === 1
                        ? "Confirm & Save"
                        : `Save All ${entries.length} Records`}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotarialCommissionDrawer;
