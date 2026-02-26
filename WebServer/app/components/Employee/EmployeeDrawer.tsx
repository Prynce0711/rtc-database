"use client";

import { AnimatePresence, motion } from "framer-motion";
import React, { useCallback, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiBriefcase,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiCopy,
  FiEdit3,
  FiEye,
  FiHeart,
  FiPlus,
  FiSave,
  FiTrash2,
  FiUser,
} from "react-icons/fi";
import { usePopup } from "../Popup/PopupProvider";
/* ─── Types ──────────────────────────────────────────────────── */
export enum EmployeeDrawerType {
  ADD = "ADD",
  EDIT = "EDIT",
}

type Step = "entry" | "review";

interface EntryForm {
  id: string;
  // Personal
  employeeName: string;
  employeeNumber: string;
  position: string;
  branch: string;
  birthDate: string;
  contactPerson: string;
  contactNumber: string;
  email: string;
  // IDs
  tinNumber: string;
  gsisNumber: string;
  philHealthNumber: string;
  pagIbigNumber: string;
  // Health
  height: string;
  weight: string;
  bloodType: string;
  allergies: string;
  errors: Record<string, string>;
}

const today = new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 9);

const emptyEntry = (id: string): EntryForm => ({
  id,
  employeeName: "",
  employeeNumber: "",
  position: "",
  branch: "",
  birthDate: today,
  contactPerson: "",
  contactNumber: "",
  email: "",
  tinNumber: "",
  gsisNumber: "",
  philHealthNumber: "",
  pagIbigNumber: "",
  height: "",
  weight: "",
  bloodType: "",
  allergies: "",
  errors: {},
});

const REQUIRED_FIELDS = [
  "employeeName",
  "position",
  "branch",
  "birthDate",
  "contactPerson",
] as const;

/* ─── Column Definitions ─────────────────────────────────────── */
type ColDef = {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "date" | "email" | "number";
  width: number;
  required?: boolean;
  mono?: boolean;
  numbersOnly?: boolean;
};

const FROZEN_COLS: ColDef[] = [
  {
    key: "employeeName",
    label: "Employee Name",
    placeholder: "Juan Dela Cruz",
    type: "text",
    width: 200,
    required: true,
  },
  {
    key: "employeeNumber",
    label: "Emp. No.",
    placeholder: "000001",
    type: "text",
    width: 120,
    mono: true,
    numbersOnly: true,
  },
];

const PERSONAL_COLS: ColDef[] = [
  {
    key: "position",
    label: "Position",
    placeholder: "Clerk IV",
    type: "text",
    width: 180,
    required: true,
  },
  {
    key: "branch",
    label: "Branch / Station",
    placeholder: "Branch 1",
    type: "text",
    width: 160,
    required: true,
  },
  {
    key: "birthDate",
    label: "Birthday",
    placeholder: "",
    type: "date",
    width: 150,
    required: true,
    mono: true,
  },
  {
    key: "contactPerson",
    label: "Contact Person",
    placeholder: "Full name",
    type: "text",
    width: 180,
    required: true,
  },
  {
    key: "contactNumber",
    label: "Contact No.",
    placeholder: "09XX-XXXX-XXXX",
    type: "text",
    width: 150,
    mono: true,
  },
  {
    key: "email",
    label: "Email",
    placeholder: "email@example.com",
    type: "email",
    width: 200,
  },
];

const IDS_COLS: ColDef[] = [
  {
    key: "tinNumber",
    label: "TIN",
    placeholder: "000-000-000",
    type: "text",
    width: 140,
    mono: true,
    numbersOnly: true,
  },
  {
    key: "gsisNumber",
    label: "GSIS",
    placeholder: "000000000000",
    type: "text",
    width: 150,
    mono: true,
    numbersOnly: true,
  },
  {
    key: "philHealthNumber",
    label: "PhilHealth",
    placeholder: "000000000000",
    type: "text",
    width: 150,
    mono: true,
    numbersOnly: true,
  },
  {
    key: "pagIbigNumber",
    label: "Pag-IBIG",
    placeholder: "000000000000",
    type: "text",
    width: 150,
    mono: true,
    numbersOnly: true,
  },
];

const HEALTH_COLS: ColDef[] = [
  {
    key: "height",
    label: "Height (cm)",
    placeholder: "170",
    type: "number",
    width: 120,
    mono: true,
  },
  {
    key: "weight",
    label: "Weight (kg)",
    placeholder: "65",
    type: "number",
    width: 120,
    mono: true,
  },
  {
    key: "bloodType",
    label: "Blood Type",
    placeholder: "O+",
    type: "text",
    width: 120,
  },
  {
    key: "allergies",
    label: "Allergies",
    placeholder: "None",
    type: "text",
    width: 200,
  },
];

type TabKey = "personal" | "ids" | "health";
const TABS: {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  cols: ColDef[];
}[] = [
  {
    key: "personal",
    label: "Personal Info",
    icon: <FiUser size={13} />,
    cols: PERSONAL_COLS,
  },
  {
    key: "ids",
    label: "IDs & Benefits",
    icon: <FiBriefcase size={13} />,
    cols: IDS_COLS,
  },
  {
    key: "health",
    label: "Health",
    icon: <FiHeart size={13} />,
    cols: HEALTH_COLS,
  },
];

const BLOOD_TYPE_MAP: Record<string, string> = {
  A_Positive: "A+",
  A_Negative: "A-",
  B_Positive: "B+",
  B_Negative: "B-",
  AB_Positive: "AB+",
  AB_Negative: "AB-",
  O_Positive: "O+",
  O_Negative: "O-",
};

/* ─── Validation ─────────────────────────────────────────────── */
function validateEntry(entry: EntryForm): Record<string, string> {
  const errs: Record<string, string> = {};
  REQUIRED_FIELDS.forEach((k) => {
    if (!entry[k] || String(entry[k]).trim() === "") errs[k] = "Required";
  });
  if (entry.email && !/^[^@]+@[^@]+$/.test(entry.email))
    errs.email = "Invalid email";
  if (
    entry.contactNumber &&
    entry.contactNumber.replace(/\D/g, "").length > 0 &&
    entry.contactNumber.replace(/\D/g, "").length !== 11
  )
    errs.contactNumber = "Must be 11 digits";
  return errs;
}

/* ─── CellInput ──────────────────────────────────────────────── */
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
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) => {
  const handleChange = (v: string) => {
    if (col.numbersOnly) v = v.replace(/\D/g, "");
    onChange(v);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <input
        type={
          col.type === "date"
            ? "date"
            : col.type === "number"
              ? "number"
              : "text"
        }
        value={value}
        placeholder={col.placeholder}
        onChange={(e) => handleChange(e.target.value)}
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

/* ─── ReviewCard ─────────────────────────────────────────────── */
function ReviewCard({ entry }: { entry: EntryForm }) {
  const fmtDate = (d: string) =>
    d
      ? new Date(d).toLocaleDateString("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : null;

  const bloodLabel = BLOOD_TYPE_MAP[entry.bloodType] || entry.bloodType || null;

  return (
    <div className="rv-card">
      <div className="rv-hero">
        <div className="rv-hero-left">
          <div className="rv-hero-casenum">
            {entry.employeeNumber ? (
              <span style={{ opacity: 0.6 }}>#{entry.employeeNumber}</span>
            ) : (
              <span style={{ opacity: 0.4 }}>No Emp. No.</span>
            )}
          </div>
          <div className="rv-hero-name">
            {entry.employeeName || (
              <span style={{ opacity: 0.4, fontSize: 18 }}>
                No name entered
              </span>
            )}
          </div>
          {entry.position && (
            <div className="rv-hero-charge">{entry.position}</div>
          )}
        </div>
        <div className="rv-hero-badges">
          {entry.branch && (
            <span className="rv-badge rv-badge-court">{entry.branch}</span>
          )}
          {bloodLabel && (
            <span
              className="rv-badge rv-badge-court"
              style={{ background: "var(--color-error)", color: "#fff" }}
            >
              {bloodLabel}
            </span>
          )}
        </div>
      </div>

      <div className="rv-body">
        <div className="rv-body-main">
          <div className="rv-section">
            <div className="rv-section-header">
              <FiUser size={13} />
              <span>Personal Information</span>
            </div>
            <div className="rv-grid rv-grid-3">
              {[
                { label: "Employee Name", value: entry.employeeName },
                {
                  label: "Employee Number",
                  value: entry.employeeNumber,
                  mono: true,
                },
                { label: "Position", value: entry.position },
                { label: "Branch / Station", value: entry.branch },
                {
                  label: "Birthday",
                  value: fmtDate(entry.birthDate),
                  mono: true,
                },
                { label: "Email", value: entry.email, mono: true },
                { label: "Contact Person", value: entry.contactPerson },
                {
                  label: "Contact Number",
                  value: entry.contactNumber,
                  mono: true,
                },
              ].map(({ label, value, mono }) => (
                <div className="rv-field" key={label}>
                  <div className="rv-field-label">{label}</div>
                  <div className={`rv-field-value${mono ? " rv-mono" : ""}`}>
                    {value || <span className="rv-empty">—</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rv-section">
            <div className="rv-section-header">
              <FiBriefcase size={13} />
              <span>IDs & Benefits</span>
            </div>
            <div className="rv-grid rv-grid-3">
              {[
                { label: "TIN", value: entry.tinNumber },
                { label: "GSIS", value: entry.gsisNumber },
                { label: "PhilHealth", value: entry.philHealthNumber },
                { label: "Pag-IBIG", value: entry.pagIbigNumber },
              ].map(({ label, value }) => (
                <div className="rv-field" key={label}>
                  <div className="rv-field-label">{label}</div>
                  <div className="rv-field-value rv-mono">
                    {value || <span className="rv-empty">—</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rv-section">
            <div className="rv-section-header">
              <FiHeart size={13} />
              <span>Health</span>
            </div>
            <div className="rv-grid rv-grid-3">
              <div className="rv-field">
                <div className="rv-field-label">Height</div>
                <div className="rv-field-value rv-mono">
                  {entry.height ? (
                    `${entry.height} cm`
                  ) : (
                    <span className="rv-empty">—</span>
                  )}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Weight</div>
                <div className="rv-field-value rv-mono">
                  {entry.weight ? (
                    `${entry.weight} kg`
                  ) : (
                    <span className="rv-empty">—</span>
                  )}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Blood Type</div>
                <div className="rv-field-value">
                  {bloodLabel || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Allergies</div>
                <div className="rv-field-value">
                  {entry.allergies || <span className="rv-empty">—</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
const EmployeeDrawer = ({
  type,
  onClose,
  selectedEmployee = null,
  onCreate,
  onUpdate,
}: {
  type: EmployeeDrawerType;
  onClose: () => void;
  selectedEmployee?: Record<string, any> | null;
  onCreate?: (employee: any) => void;
  onUpdate?: (employee: any) => void;
}) => {
  const isEdit = type === EmployeeDrawerType.EDIT;
  const statusPopup = usePopup();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("entry");
  const [activeTab, setActiveTab] = useState<TabKey>("personal");
  const [reviewIdx, setReviewIdx] = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);

  const [entries, setEntries] = useState<EntryForm[]>(() => {
    if (isEdit && selectedEmployee) {
      const e = selectedEmployee;
      return [
        {
          ...emptyEntry(uid()),
          employeeName: e.employeeName ?? "",
          employeeNumber: e.employeeNumber ?? "",
          position: e.position ?? "",
          branch: e.branch ?? "",
          birthDate: e.birthDate ? String(e.birthDate).slice(0, 10) : today,
          contactPerson: e.contactPerson ?? "",
          contactNumber: e.contactNumber ?? "",
          email: e.email ?? "",
          tinNumber: e.tinNumber ?? "",
          gsisNumber: e.gsisNumber ?? "",
          philHealthNumber: e.philHealthNumber ?? "",
          pagIbigNumber: e.pagIbigNumber ?? "",
          height: e.height != null ? String(e.height) : "",
          weight: e.weight != null ? String(e.weight) : "",
          bloodType: e.bloodType ?? "",
          allergies: e.allergies ?? "",
        },
      ];
    }
    return [emptyEntry(uid())];
  });

  const handleChange = (id: string, field: string, value: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, [field]: value, errors: { ...e.errors, [field]: "" } }
          : e,
      ),
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

  const handleRemove = (id: string) =>
    setEntries((prev) => prev.filter((e) => e.id !== id));

  const handleDuplicate = (id: string) => {
    const source = entries.find((e) => e.id === id);
    if (!source) return;
    const dup: EntryForm = {
      ...source,
      id: uid(),
      employeeName: "",
      employeeNumber: "",
      errors: {},
    };
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, dup);
      return next;
    });
  };

  const activeCols = TABS.find((t) => t.key === activeTab)!.cols;
  const currentTabIdx = TABS.findIndex((t) => t.key === activeTab);
  const isLastTab = currentTabIdx === TABS.length - 1;

  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    entryId: string,
    isLastCol: boolean,
    isLastTabFlag: boolean,
  ) => {
    if (e.key === "Tab" && !e.shiftKey && isLastCol && isLastTabFlag) {
      const isLastRow = entries[entries.length - 1]?.id === entryId;
      if (isLastRow && !isEdit) {
        e.preventDefault();
        handleAddEntry();
        setTimeout(() => {
          const rows = tableRef.current?.querySelectorAll("[data-row]");
          const lastRow = rows?.[rows.length - 1];
          (lastRow?.querySelector("input") as HTMLInputElement)?.focus();
        }, 80);
      }
    }
  };

  const completedCount = entries.filter((e) =>
    REQUIRED_FIELDS.every((k) => e[k] && String(e[k]).trim() !== ""),
  ).length;
  const incompleteCount = entries.length - completedCount;

  const handleGoToReview = () => {
    let anyError = false;
    const validated = entries.map((e) => {
      const errs = validateEntry(e);
      if (Object.keys(errs).length > 0) {
        anyError = true;
        return { ...e, errors: errs };
      }
      return e;
    });
    setEntries(validated);
    if (anyError) {
      statusPopup.showError(
        "Please fill in all required fields before reviewing.",
      );
      return;
    }
    setReviewIdx(0);
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    const label = isEdit
      ? "Save changes to this employee?"
      : entries.length === 1
        ? "Create this employee?"
        : `Create ${entries.length} employees?`;

    if (!(await statusPopup.showConfirm(label))) return;

    setIsSubmitting(true);
    statusPopup.showLoading(
      isEdit ? "Updating employee..." : "Creating employee(s)...",
    );

    try {
      const payloads = entries.map((e) => ({
        id: isEdit ? (selectedEmployee?.id ?? 0) : 0,
        employeeName: e.employeeName,
        employeeNumber: e.employeeNumber || undefined,
        position: e.position,
        branch: e.branch,
        birthDate: e.birthDate,
        contactPerson: e.contactPerson,
        contactNumber: e.contactNumber || undefined,
        email: e.email?.trim() || undefined,
        tinNumber: e.tinNumber || undefined,
        gsisNumber: e.gsisNumber || undefined,
        philHealthNumber: e.philHealthNumber || undefined,
        pagIbigNumber: e.pagIbigNumber || undefined,
        height: e.height ? Number(e.height) : undefined,
        weight: e.weight ? Number(e.weight) : undefined,
        bloodType: e.bloodType || undefined,
        allergies:
          e.allergies?.trim() === "" || e.allergies?.toLowerCase() === "n/a"
            ? undefined
            : e.allergies || undefined,
      }));

      const resp = await fetch("/api/employees/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloads),
      });
      const json = await resp.json();
      if (!resp.ok || !json.success)
        throw new Error(json.error || "Save failed");

      const created = json.result || [];
      if (isEdit) {
        if (created[0]) {
          onUpdate?.(created[0]);
          statusPopup.showSuccess("Employee updated successfully");
        } else {
          statusPopup.showError("Update failed");
        }
      } else {
        created.forEach((c: any) => onCreate?.(c));
        statusPopup.showSuccess(
          created.length === 1
            ? "Employee created successfully"
            : `${created.length} employees created successfully`,
        );
      }
      onClose();
    } catch (err) {
      statusPopup.showError(
        err instanceof Error
          ? err.message
          : "An error occurred. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
      statusPopup.hidePopup();
    }
  };

  const ROW_NUM_W = 48;
  const ACTION_W = 72;

  return (
    <div className="xls-root">
      {/* ══ TOPBAR ══ */}
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
            <span>Employees</span>
            <FiChevronRight size={12} className="xls-breadcrumb-sep" />
            <span className="xls-breadcrumb-current">
              {isEdit ? "Edit Employee" : "New Employees"}
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

      {/* ══ BODY ══ */}
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
            {/* Title row */}
            <div className="xls-title-row">
              <div>
                <h1 className="text-5xl xls-title">
                  {isEdit ? "Edit Employee" : "New Employees"}
                </h1>
                <p className="text-lg mb-9 xls-subtitle">
                  {isEdit ? (
                    "Update employee details. Required fields are marked *."
                  ) : (
                    <>
                      Fill rows like a spreadsheet —{" "}
                      <kbd className="xls-kbd">Tab</kbd> past the last cell to
                      add a new row.
                    </>
                  )}
                </p>
                {!isEdit && (
                  <div className="xls-pills" style={{ marginTop: 10 }}>
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

            {/* Progress bar */}
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

            {/* Spreadsheet */}
            <div className="xls-sheet-wrap">
              {/* Tab bar */}
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
              </div>

              <div className="xls-table-outer" ref={tableRef}>
                <table className="xls-table">
                  <colgroup>
                    <col style={{ width: ROW_NUM_W }} />
                    {FROZEN_COLS.map((c) => (
                      <col key={c.key} style={{ width: c.width }} />
                    ))}
                    {activeCols.map((c) => (
                      <col key={c.key} style={{ width: c.width }} />
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
                          {TABS.find((t) => t.key === activeTab)?.label}
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
                        return (
                          <motion.tr
                            key={entry.id}
                            data-row
                            layout
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                            transition={{ duration: 0.12 }}
                            className="xls-row"
                          >
                            <td className="td-num">
                              <span className="xls-rownum">{rowIdx + 1}</span>
                            </td>

                            {FROZEN_COLS.map((col) => (
                              <td key={col.key}>
                                <CellInput
                                  col={col}
                                  value={(entry as any)[col.key] ?? ""}
                                  error={entry.errors[col.key]}
                                  onChange={(v) =>
                                    handleChange(entry.id, col.key, v)
                                  }
                                />
                              </td>
                            ))}

                            {activeCols.map((col, colIdx) => (
                              <td key={col.key}>
                                <CellInput
                                  col={col}
                                  value={(entry as any)[col.key] ?? ""}
                                  error={entry.errors[col.key]}
                                  onChange={(v) =>
                                    handleChange(entry.id, col.key, v)
                                  }
                                  onKeyDown={(e) =>
                                    handleCellKeyDown(
                                      e,
                                      entry.id,
                                      colIdx === lastColIdx,
                                      isLastTab,
                                    )
                                  }
                                />
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

            {/* Footer */}
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
          /* ══ REVIEW STEP ══ */
          <motion.div
            key="review"
            className="xls-main"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {/* Summary banner */}
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
                        : `Review ${entries.length} employees before saving`}
                  </p>
                  <p className="rv-summary-sub">
                    {isEdit
                      ? "Check the details below, then confirm your changes."
                      : "All fields validated. Confirm the details are correct."}
                  </p>
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

            {/* Review layout */}
            <div className="rv-layout">
              {entries.length > 1 && (
                <div className="rv-sidebar">
                  <div className="rv-sidebar-head">
                    {entries.length} Employees
                  </div>
                  <div className="rv-sidebar-list">
                    {entries.map((entry, idx) => (
                      <button
                        key={entry.id}
                        className={`rv-sidebar-item${reviewIdx === idx ? " active" : ""}`}
                        onClick={() => setReviewIdx(idx)}
                      >
                        <span className="rv-sidebar-num">{idx + 1}</span>
                        <div className="rv-sidebar-info">
                          <div className="rv-sidebar-casenum">
                            {entry.employeeName || "No name"}
                          </div>
                          <div className="rv-sidebar-name">
                            {entry.position || "No position"}
                          </div>
                        </div>
                      </button>
                    ))}
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
                    <ReviewCard entry={entries[reviewIdx]} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Review footer */}
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
                      onClick={() => setReviewIdx((i) => Math.max(0, i - 1))}
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
                        setReviewIdx((i) => Math.min(entries.length - 1, i + 1))
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
                        : `Save All ${entries.length} Employees`}
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

export default EmployeeDrawer;
