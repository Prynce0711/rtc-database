"use client";

import { Case } from "@/app/generated/prisma/browser";
import { AnimatePresence, motion } from "framer-motion";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiCopy,
  FiDollarSign,
  FiEdit3,
  FiEye,
  FiFileText,
  FiMapPin,
  FiPlus,
  FiSave,
  FiTrash2,
  FiUsers,
} from "react-icons/fi";
import { usePopup } from "../Popup/PopupProvider";
import { createCase, updateCase } from "./CasesActions";
import {
  CaseSchema,
  FormEntry,
  caseToFormEntry,
  createEmptyFormEntry,
} from "./schema";

const uid = () => Math.random().toString(36).slice(2, 9);

export enum CaseModalType {
  ADD = "ADD",
  EDIT = "EDIT",
}

type Step = "entry" | "review";

const REQUIRED_FIELDS = [
  "branch",
  "assistantBranch",
  "caseNumber",
  "dateFiled",
  "caseType",
  "name",
  "charge",
  "infoSheet",
  "court",
  "consolidation",
] as const;

type ColDef = {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "date" | "number" | "checkbox" | "select";
  width: number;
  required?: boolean;
  mono?: boolean;
  options?: { value: string; label: string }[];
};

const FROZEN_COLS: ColDef[] = [
  {
    key: "caseNumber",
    label: "Case No.",
    placeholder: "CR-2026-0001",
    type: "text",
    width: 152,
    required: true,
    mono: true,
  },
  {
    key: "name",
    label: "Accused Name",
    placeholder: "Full name",
    type: "text",
    width: 200,
    required: true,
  },
];

type TabGroup = {
  id: string;
  label: string;
  cols: ColDef[];
};

const TAB_GROUPS: TabGroup[] = [
  {
    id: "identity",
    label: "Case Identity",
    cols: [
      {
        key: "branch",
        label: "Branch",
        placeholder: "Branch 1",
        type: "text",
        width: 115,
        required: true,
      },
      {
        key: "assistantBranch",
        label: "Asst. Branch",
        placeholder: "Branch 2",
        type: "text",
        width: 115,
        required: true,
      },
      {
        key: "dateFiled",
        label: "Date Filed",
        placeholder: "",
        type: "date",
        width: 148,
        required: true,
        mono: true,
      },
      {
        key: "raffleDate",
        label: "Raffle Date",
        placeholder: "",
        type: "date",
        width: 148,
        mono: true,
      },
      {
        key: "infoSheet",
        label: "Info Sheet",
        placeholder: "IS-001",
        type: "text",
        width: 115,
        required: true,
      },
      {
        key: "court",
        label: "Court",
        placeholder: "RTC Br. 1",
        type: "text",
        width: 125,
        required: true,
      },
      {
        key: "consolidation",
        label: "Consolidation",
        placeholder: "N/A",
        type: "text",
        width: 135,
        required: true,
      },
      {
        key: "caseType",
        label: "Case Type",
        placeholder: "Select case type",
        type: "select",
        width: 150,
        options: [
          { value: "CRIMINAL", label: "Criminal" },
          { value: "CIVIL", label: "Civil" },
          { value: "LAND_REGISTRATION_CASE", label: "Land Registration" },
          { value: "PETITION", label: "Petition" },
          { value: "ELECTION", label: "Election" },
          { value: "SCA", label: "SCA" },
          { value: "UNKNOWN", label: "Unknown" },
        ],
      },
    ],
  },
  {
    id: "accused",
    label: "Accused Info",
    cols: [
      {
        key: "charge",
        label: "Charge",
        placeholder: "Charge description",
        type: "text",
        width: 210,
        required: true,
      },
      {
        key: "detained",
        label: "Detained",
        placeholder: "",
        type: "checkbox",
        width: 88,
      },
      {
        key: "bond",
        label: "Bond (₱)",
        placeholder: "0.00",
        type: "number",
        width: 125,
        mono: true,
      },
      {
        key: "eqcNumber",
        label: "EQC No.",
        placeholder: "—",
        type: "number",
        width: 100,
        mono: true,
      },
    ],
  },
  {
    id: "personnel",
    label: "Personnel",
    cols: [
      {
        key: "Judge",
        label: "Judge",
        placeholder: "Judge name",
        type: "text",
        width: 165,
      },
      {
        key: "AO",
        label: "AO",
        placeholder: "AO name",
        type: "text",
        width: 145,
      },
      {
        key: "Complainant",
        label: "Complainant",
        placeholder: "Complainant name",
        type: "text",
        width: 175,
      },
      {
        key: "committe1",
        label: "Committee 1",
        placeholder: "—",
        type: "number",
        width: 108,
        mono: true,
      },
      {
        key: "committe2",
        label: "Committee 2",
        placeholder: "—",
        type: "number",
        width: 108,
        mono: true,
      },
    ],
  },
  {
    id: "address",
    label: "Address",
    cols: [
      {
        key: "HouseNo",
        label: "House No.",
        placeholder: "123",
        type: "text",
        width: 92,
      },
      {
        key: "Street",
        label: "Street",
        placeholder: "Street name",
        type: "text",
        width: 155,
      },
      {
        key: "Barangay",
        label: "Barangay",
        placeholder: "Brgy.",
        type: "text",
        width: 135,
      },
      {
        key: "Municipality",
        label: "Municipality",
        placeholder: "Municipality",
        type: "text",
        width: 150,
      },
      {
        key: "Province",
        label: "Province",
        placeholder: "Province",
        type: "text",
        width: 135,
      },
    ],
  },
  {
    id: "financials",
    label: "Financials",
    cols: [
      {
        key: "Counts",
        label: "Counts",
        placeholder: "0",
        type: "number",
        width: 84,
        mono: true,
      },
      {
        key: "AmountInvolved",
        label: "Amt. Involved",
        placeholder: "0.00",
        type: "number",
        width: 138,
        mono: true,
      },
      {
        key: "Jdf",
        label: "JDF",
        placeholder: "0.00",
        type: "number",
        width: 95,
        mono: true,
      },
      {
        key: "Sajj",
        label: "SAJJ",
        placeholder: "0.00",
        type: "number",
        width: 95,
        mono: true,
      },
      {
        key: "Sajj2",
        label: "SAJJ 2",
        placeholder: "0.00",
        type: "number",
        width: 95,
        mono: true,
      },
      {
        key: "MF",
        label: "MF",
        placeholder: "0.00",
        type: "number",
        width: 95,
        mono: true,
      },
      {
        key: "STF",
        label: "STF",
        placeholder: "0.00",
        type: "number",
        width: 95,
        mono: true,
      },
      {
        key: "LRF",
        label: "LRF",
        placeholder: "0.00",
        type: "number",
        width: 95,
        mono: true,
      },
      {
        key: "VCF",
        label: "VCF",
        placeholder: "0.00",
        type: "number",
        width: 95,
        mono: true,
      },
      {
        key: "Total",
        label: "Total",
        placeholder: "0.00",
        type: "number",
        width: 115,
        mono: true,
      },
    ],
  },
];

function validateEntry(entry: FormEntry): Record<string, string> {
  const errs: Record<string, string> = {};
  REQUIRED_FIELDS.forEach((k) => {
    if (
      !entry[k as keyof FormEntry] ||
      String(entry[k as keyof FormEntry]).trim() === ""
    )
      errs[k] = "Required";
  });
  return errs;
}

/* ─── Cell Input ─────────────────────────────────────────────── */
const CellInput = ({
  col,
  value,
  error,
  onChange,
  onKeyDown,
}: {
  col: ColDef;
  value: string | boolean;
  error?: string;
  onChange: (v: string | boolean) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) => {
  if (col.type === "checkbox") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 44,
          padding: "0 12px",
        }}
      >
        <input
          type="checkbox"
          className="xls-checkbox"
          checked={value as boolean}
          onChange={(e) => onChange(e.target.checked)}
          title="Detained?"
        />
      </div>
    );
  }
  if (col.type === "select") {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <select
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          title={error || col.label}
          className={`xls-input${error ? " xls-input-err" : ""}`}
          style={{ height: 44 }}
        >
          {col.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <span className="xls-cell-err">
            <FiAlertCircle size={10} />
            {error}
          </span>
        )}
      </div>
    );
  }
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
        step={col.type === "number" ? "0.01" : undefined}
        value={value as string}
        placeholder={col.placeholder}
        onChange={(e) => onChange(e.target.value)}
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

/* ─── Review: single case card ───────────────────────────────── */
function ReviewCard({ entry }: { entry: FormEntry }) {
  const filledAddress =
    [
      entry.HouseNo,
      entry.Street,
      entry.Barangay,
      entry.Municipality,
      entry.Province,
    ]
      .filter(Boolean)
      .join(", ") || null;

  const financialRows = [
    { label: "Counts", value: entry.Counts || null, isCurrency: false },
    { label: "Amt. Involved", value: entry.AmountInvolved, isCurrency: true },
    { label: "JDF", value: entry.Jdf, isCurrency: true },
    { label: "SAJJ", value: entry.Sajj, isCurrency: true },
    { label: "SAJJ 2", value: entry.Sajj2, isCurrency: true },
    { label: "MF", value: entry.MF, isCurrency: true },
    { label: "STF", value: entry.STF, isCurrency: true },
    { label: "LRF", value: entry.LRF, isCurrency: true },
    { label: "VCF", value: entry.VCF, isCurrency: true },
    { label: "Total", value: entry.Total, isCurrency: true, isTotal: true },
  ]
    .filter((r) => r.value && r.value !== "")
    .map((r) => ({
      ...r,
      display:
        r.isCurrency && r.value
          ? `₱ ${parseFloat(r.value).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
          : r.value,
    }));

  const fmtDate = (d: string) =>
    d
      ? new Date(d).toLocaleDateString("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : null;

  return (
    <div className="rv-card">
      <div className="rv-hero">
        <div className="rv-hero-left">
          <div className="rv-hero-casenum">
            {entry.caseNumber || (
              <span style={{ opacity: 0.4 }}>No Case No.</span>
            )}
          </div>
          <div className="rv-hero-name">
            {entry.name || (
              <span style={{ opacity: 0.4, fontSize: 18 }}>
                No name entered
              </span>
            )}
          </div>
          {entry.charge && <div className="rv-hero-charge">{entry.charge}</div>}
        </div>
        <div className="rv-hero-badges">
          <span
            className={`rv-badge ${entry.detained ? "rv-badge-detained" : "rv-badge-released"}`}
          >
            {entry.detained ? "Detained" : "Released"}
          </span>
          {entry.court && (
            <span className="rv-badge rv-badge-court">{entry.court}</span>
          )}
        </div>
      </div>

      <div className="rv-body">
        <div className="rv-body-main">
          <div className="rv-section">
            <div className="rv-section-header">
              <FiFileText size={13} />
              <span>Case Identity</span>
            </div>
            <div className="rv-grid rv-grid-3">
              <div className="rv-field">
                <div className="rv-field-label">Branch</div>
                <div className="rv-field-value">
                  {entry.branch || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Asst. Branch</div>
                <div className="rv-field-value">
                  {entry.assistantBranch || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Info Sheet</div>
                <div className="rv-field-value rv-mono">
                  {entry.infoSheet || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Date Filed</div>
                <div className="rv-field-value rv-mono">
                  {fmtDate(entry.dateFiled) || (
                    <span className="rv-empty">—</span>
                  )}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Raffle Date</div>
                <div className="rv-field-value rv-mono">
                  {fmtDate(entry.raffleDate) || (
                    <span className="rv-empty">—</span>
                  )}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Consolidation</div>
                <div className="rv-field-value">
                  {entry.consolidation || <span className="rv-empty">—</span>}
                </div>
              </div>
              {entry.eqcNumber && (
                <div className="rv-field">
                  <div className="rv-field-label">EQC No.</div>
                  <div className="rv-field-value rv-mono">
                    {entry.eqcNumber}
                  </div>
                </div>
              )}
              {entry.bond && (
                <div className="rv-field">
                  <div className="rv-field-label">Bond</div>
                  <div className="rv-field-value rv-mono">
                    ₱{" "}
                    {parseFloat(entry.bond).toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rv-section">
            <div className="rv-section-header">
              <FiUsers size={13} />
              <span>Personnel</span>
            </div>
            <div className="rv-grid rv-grid-2">
              <div className="rv-field">
                <div className="rv-field-label">Judge</div>
                <div className="rv-field-value">
                  {entry.Judge || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Administrative Officer</div>
                <div className="rv-field-value">
                  {entry.AO || <span className="rv-empty">—</span>}
                </div>
              </div>
              <div className="rv-field">
                <div className="rv-field-label">Complainant</div>
                <div className="rv-field-value">
                  {entry.Complainant || <span className="rv-empty">—</span>}
                </div>
              </div>
              {entry.committe1 && (
                <div className="rv-field">
                  <div className="rv-field-label">Committee 1</div>
                  <div className="rv-field-value rv-mono">
                    {entry.committe1}
                  </div>
                </div>
              )}
              {entry.committe2 && (
                <div className="rv-field">
                  <div className="rv-field-label">Committee 2</div>
                  <div className="rv-field-value rv-mono">
                    {entry.committe2}
                  </div>
                </div>
              )}
            </div>
          </div>

          {filledAddress && (
            <div className="rv-section">
              <div className="rv-section-header">
                <FiMapPin size={13} />
                <span>Address</span>
              </div>
              <div className="rv-address-line">{filledAddress}</div>
            </div>
          )}
        </div>

        {financialRows.length > 0 && (
          <div className="rv-fin-sidebar">
            <div className="rv-section-header" style={{ marginBottom: 12 }}>
              <FiDollarSign size={13} />
              <span>Financials</span>
            </div>
            <div className="rv-fin-table">
              {financialRows.map((row) => (
                <div
                  key={row.label}
                  className={`rv-fin-row${row.isTotal ? " rv-fin-total" : ""}`}
                >
                  <span className="rv-fin-label">{row.label}</span>
                  <span className="rv-fin-value">{row.display}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
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
  const isEdit = type === CaseModalType.EDIT;
  const statusPopup = usePopup();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("entry");
  const [activeTab, setActiveTab] = useState(0);
  const [reviewIdx, setReviewIdx] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const makeFromCase = (sc: Case): FormEntry => caseToFormEntry(uid(), sc);

  const [entries, setEntries] = useState<FormEntry[]>(() => {
    if (isEdit && selectedCase) return [makeFromCase(selectedCase)];
    return [createEmptyFormEntry(uid())];
  });

  useEffect(() => {
    if (!isEdit) {
      setEntries([createEmptyFormEntry(uid())]);
      setStep("entry");
      setActiveTab(0);
    }
  }, [type, selectedCase, isEdit]);

  const handleChange = (id: string, field: string, value: string | boolean) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, [field]: value, errors: { ...e.errors, [field]: "" } }
          : e,
      ),
    );
  };

  const handleAddEntry = useCallback(() => {
    setEntries((prev) => [...prev, createEmptyFormEntry(uid())]);
    setTimeout(() => {
      scrollAreaRef.current?.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 60);
  }, []);

  const handleRemove = (id: string) =>
    setEntries((prev) => prev.filter((e) => e.id !== id));

  const handleDuplicate = (id: string) => {
    const source = entries.find((e) => e.id === id);
    if (!source) return;
    const dup: FormEntry = {
      ...source,
      id: uid(),
      caseNumber: "",
      errors: {},
      saved: false,
      collapsed: false,
    };
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, dup);
      return next;
    });
  };

  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    entryId: string,
    isLastColOfTab: boolean,
  ) => {
    if (e.key === "Tab" && !e.shiftKey && isLastColOfTab) {
      const isLastRow = entries[entries.length - 1]?.id === entryId;
      if (isLastRow && !isEdit) {
        e.preventDefault();
        handleAddEntry();
        setTimeout(() => {
          const rows = scrollAreaRef.current?.querySelectorAll("[data-row]");
          const lastRow = rows?.[rows.length - 1];
          (lastRow?.querySelector("input") as HTMLInputElement)?.focus();
        }, 80);
      }
    }
  };

  const completedCount = entries.filter((e) =>
    REQUIRED_FIELDS.every(
      (k) =>
        e[k as keyof FormEntry] &&
        String(e[k as keyof FormEntry]).trim() !== "",
    ),
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

  const buildPayload = (e: FormEntry) => ({
    branch: e.branch,
    assistantBranch: e.assistantBranch,
    caseNumber: e.caseNumber,
    dateFiled: e.dateFiled,
    caseType: e.caseType || "UNKNOWN",
    name: e.name,
    charge: e.charge,
    infoSheet: e.infoSheet,
    court: e.court,
    detained: e.detained,
    consolidation: e.consolidation,
    eqcNumber: e.eqcNumber ? parseInt(e.eqcNumber) : null,
    bond: e.bond ? parseFloat(e.bond) : null,
    raffleDate: e.raffleDate || null,
    committe1: e.committe1 ? parseInt(e.committe1) : null,
    committe2: e.committe2 ? parseInt(e.committe2) : null,
    Judge: e.Judge || null,
    AO: e.AO || null,
    Complainant: e.Complainant || null,
    HouseNo: e.HouseNo || null,
    Street: e.Street || null,
    Barangay: e.Barangay || null,
    Municipality: e.Municipality || null,
    Province: e.Province || null,
    Counts: e.Counts ? parseInt(e.Counts) : null,
    Jdf: e.Jdf ? parseFloat(e.Jdf) : null,
    Sajj: e.Sajj ? parseFloat(e.Sajj) : null,
    Sajj2: e.Sajj2 ? parseFloat(e.Sajj2) : null,
    MF: e.MF ? parseFloat(e.MF) : null,
    STF: e.STF ? parseFloat(e.STF) : null,
    LRF: e.LRF ? parseFloat(e.LRF) : null,
    VCF: e.VCF ? parseFloat(e.VCF) : null,
    Total: e.Total ? parseFloat(e.Total) : null,
    AmountInvolved: e.AmountInvolved ? parseFloat(e.AmountInvolved) : null,
  });

  const handleSubmit = async () => {
    const label = isEdit
      ? "Save changes to this case?"
      : entries.length === 1
        ? "Create this case?"
        : `Create ${entries.length} cases?`;
    if (!(await statusPopup.showConfirm(label))) return;
    setIsSubmitting(true);
    statusPopup.showLoading(
      isEdit ? "Updating case..." : "Creating case(s)...",
    );
    try {
      if (isEdit && selectedCase) {
        const payload = buildPayload(entries[0]);
        const validation = CaseSchema.safeParse(payload);
        if (!validation.success) throw new Error("Invalid data");
        const response = await updateCase(selectedCase.id, {
          ...payload,
          dateFiled: new Date(payload.dateFiled).toISOString(),
          raffleDate: payload.raffleDate
            ? new Date(payload.raffleDate).toISOString()
            : null,
        });
        if (!response.success)
          throw new Error(response.error || "Failed to update case");
        onUpdate?.(response.result);
        statusPopup.showSuccess("Case updated successfully");
      } else {
        for (const entry of entries) {
          const payload = buildPayload(entry);
          const validation = CaseSchema.safeParse(payload);
          if (!validation.success) throw new Error("Invalid data");
          const response = await createCase({
            ...payload,
            dateFiled: new Date(payload.dateFiled).toISOString(),
            raffleDate: payload.raffleDate
              ? new Date(payload.raffleDate).toISOString()
              : null,
          });
          if (!response.success)
            throw new Error(response.error || "Failed to create case");
          onCreate?.(response.result);
        }
        statusPopup.showSuccess(
          entries.length === 1
            ? "Case created successfully"
            : `${entries.length} cases created successfully`,
        );
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

  const currentTabCols = TAB_GROUPS[activeTab].cols;
  const tabHasErrors = (tabIdx: number) =>
    entries.some((e) => TAB_GROUPS[tabIdx].cols.some((c) => e.errors[c.key]));

  const ROW_NUM_W = 48;
  const ACTION_W = 72;

  return (
    <>
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
              <span>Cases</span>
              <FiChevronRight size={12} className="xls-breadcrumb-sep" />
              <span className="xls-breadcrumb-current">
                {isEdit ? "Edit Case" : "New Cases"}
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
              <div
                className={`xls-step ${step === "entry" ? "active" : "done"}`}
              >
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
              <div className="xls-title-row">
                <div>
                  <h1 className="text-5xl xls-title">
                    {isEdit ? "Edit Case Record" : "New Case Entries"}
                  </h1>
                  <p className="text-lg mb-9 xls-subtitle">
                    {isEdit ? (
                      "Update case details. Required fields are marked *."
                    ) : (
                      <>
                        Use tabs to switch between field groups.{" "}
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
                  {TAB_GROUPS.map((grp, idx) => {
                    const hasErr = tabHasErrors(idx);
                    return (
                      <button
                        key={grp.id}
                        className={`xls-tab${activeTab === idx ? " active" : ""}`}
                        onClick={() => setActiveTab(idx)}
                      >
                        {grp.label}
                        {hasErr && <span className="xls-tab-errbadge">!</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="xls-table-outer" ref={scrollAreaRef}>
                  <table className="xls-table">
                    <colgroup>
                      <col style={{ width: ROW_NUM_W }} />
                      {FROZEN_COLS.map((c) => (
                        <col key={c.key} style={{ width: c.width }} />
                      ))}
                      {currentTabCols.map((c) => (
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
                        <th colSpan={currentTabCols.length}>
                          <div className="xls-group-label">
                            {TAB_GROUPS[activeTab].label}
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
                        {currentTabCols.map((col) => (
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
                          const lastColIdx = currentTabCols.length - 1;
                          return (
                            <motion.tr
                              key={entry.id}
                              data-row
                              layout
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{
                                opacity: 0,
                                height: 0,
                                overflow: "hidden",
                              }}
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
                                    value={
                                      (
                                        entry as unknown as Record<
                                          string,
                                          string | boolean
                                        >
                                      )[col.key]
                                    }
                                    error={entry.errors[col.key]}
                                    onChange={(v) =>
                                      handleChange(entry.id, col.key, v)
                                    }
                                  />
                                </td>
                              ))}
                              {currentTabCols.map((col, colIdx) => (
                                <td key={col.key}>
                                  <CellInput
                                    col={col}
                                    value={
                                      (
                                        entry as unknown as Record<
                                          string,
                                          string | boolean
                                        >
                                      )[col.key]
                                    }
                                    error={entry.errors[col.key]}
                                    onChange={(v) =>
                                      handleChange(entry.id, col.key, v)
                                    }
                                    onKeyDown={(e) =>
                                      handleCellKeyDown(
                                        e,
                                        entry.id,
                                        colIdx === lastColIdx,
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
                    {!isEdit && entries.length > 1
                      ? ` (${entries.length})`
                      : ""}
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
                          : `Review ${entries.length} cases before saving`}
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

              <div className="rv-layout">
                {entries.length > 1 && (
                  <div className="rv-sidebar">
                    <div className="rv-sidebar-head">
                      {entries.length} Cases
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
                              {entry.caseNumber || "No case no."}
                            </div>
                            <div className="rv-sidebar-name">
                              {entry.name || "No name"}
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
                          setReviewIdx((i) =>
                            Math.min(entries.length - 1, i + 1),
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
                          : `Save All ${entries.length} Cases`}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default NewCaseModal;
