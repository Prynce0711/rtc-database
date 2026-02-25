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
      {/* ── Hero: key identifiers at a glance ── */}
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

      {/* ── Body ── */}
      <div className="rv-body">
        {/* Left: all field sections */}
        <div className="rv-body-main">
          {/* Case Identity */}
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

          {/* Personnel */}
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

          {/* Address */}
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

        {/* Right: financials */}
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
      <style>{`
        .xls-root {
          font-family: var(--font-montserrat), ui-sans-serif, system-ui;
          min-height: 100vh;
          background: var(--color-base-200);
          color: var(--color-base-content);
          -webkit-font-smoothing: antialiased;
          display: flex; flex-direction: column;
        }

        /* ══ TOPBAR ══ */
        .xls-topbar {
          position: sticky; top: 0; z-index: 60;
          background: var(--surface-glass-strong);
          backdrop-filter: blur(18px) saturate(1.6);
          border-bottom: 1px solid var(--surface-border);
          padding: 0 32px; height: 68px;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          box-shadow: var(--shadow-xs);
        }
        .xls-topbar-left  { display: flex; align-items: center; gap: 14px; }
        .xls-topbar-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .xls-back-btn {
          width: 38px; height: 38px; border-radius: var(--radius-sm);
          border: 1px solid var(--surface-border); background: var(--surface-card);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--color-muted); transition: all var(--transition-fast);
        }
        .xls-back-btn:hover { background: var(--surface-hover); color: var(--color-base-content); border-color: var(--surface-border-strong); }
        .xls-breadcrumb { display: flex; align-items: center; gap: 7px; font-size: 15.5px; color: var(--color-muted); font-weight: 500; }
        .xls-breadcrumb-sep { opacity: 0.3; }
        .xls-breadcrumb-current { color: var(--color-base-content); font-weight: 700; }

        .xls-stepper { display: flex; align-items: center; background: var(--surface-inset); border-radius: var(--radius-pill); padding: 4px; border: 1px solid var(--surface-border); }
        .xls-step { display: flex; align-items: center; gap: 8px; padding: 8px 18px; border-radius: var(--radius-pill); font-size: 14px; font-weight: 600; color: var(--color-muted); transition: all var(--transition-base); white-space: nowrap; }
        .xls-step.active { background: var(--color-primary); color: var(--color-primary-content); }
        .xls-step.done { color: var(--color-success); }
        .xls-step-dot { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.08); flex-shrink: 0; font-size: 12px; }
        .xls-step.active .xls-step-dot { background: rgba(255,255,255,0.12); }
        .xls-step.done .xls-step-dot { background: var(--color-success-soft); color: var(--color-success); }

        /* ── Buttons ── */
        .xls-btn { display: inline-flex; align-items: center; gap: 8px; padding: 0 22px; height: 42px; border-radius: var(--radius-field); font-size: 15px; font-weight: 600; font-family: inherit; cursor: pointer; border: none; transition: all var(--transition-fast); white-space: nowrap; }
        .xls-btn-ghost { background: transparent; color: var(--color-muted); border: 1px solid var(--surface-border); }
        .xls-btn-ghost:hover { background: var(--surface-hover); color: var(--color-base-content); border-color: var(--surface-border-strong); }
        .xls-btn-primary { background: var(--color-primary); color: var(--color-primary-content); }
        .xls-btn-primary:hover { filter: brightness(1.1); transform: translateY(-1px); box-shadow: var(--shadow-soft); }
        .xls-btn-primary:active { transform: none; }
        .xls-btn-success { background: var(--color-success); color: var(--color-success-content); box-shadow: var(--shadow-xs); }
        .xls-btn-success:hover { filter: brightness(1.07); transform: translateY(-1px); box-shadow: var(--shadow-soft); }
        .xls-btn-success:disabled { opacity: 0.5; cursor: not-allowed; transform: none; filter: none; }
        .xls-btn-outline { background: transparent; color: var(--color-base-content); border: 1.5px solid var(--surface-border-strong); }
        .xls-btn-outline:hover { background: var(--surface-hover); }
        .xls-btn-icon { width: 36px; height: 36px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); background: var(--surface-card); color: var(--color-muted); border: 1px solid var(--surface-border); cursor: pointer; transition: all var(--transition-fast); font-family: inherit; flex-shrink: 0; }
        .xls-btn-icon:hover { background: var(--surface-hover); color: var(--color-base-content); border-color: var(--surface-border-strong); }
        .xls-btn-icon:disabled { opacity: 0.3; cursor: not-allowed; }

        /* ══ MAIN ══ */
        .xls-main { padding: 28px 32px 64px; display: flex; flex-direction: column; gap: 20px; }
        .xls-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .xls-title { font-size: 28px; font-weight: 700; letter-spacing: -0.6px; margin: 0 0 6px; }
        .xls-subtitle { font-size: 15.5px; color: var(--color-muted); margin: 0; line-height: 1.55; }
        .xls-pills { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
        .xls-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 13px; border-radius: var(--radius-pill); font-size: 13px; font-weight: 600; }
        .xls-pill-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: 0.55; }
        .xls-pill-neutral { background: var(--surface-inset); color: var(--color-muted); border: 1px solid var(--surface-border); }
        .xls-pill-ok { background: var(--color-success-soft); color: var(--color-success); }
        .xls-pill-err { background: var(--color-error-soft); color: var(--color-error); }
        .xls-progress { height: 4px; background: var(--surface-border); border-radius: 99px; overflow: hidden; }
        .xls-progress-fill { height: 100%; background: var(--color-primary); border-radius: 99px; transition: width 0.4s cubic-bezier(0.4,0,0.2,1); }

        /* ══ SHEET ══ */
        .xls-sheet-wrap { background: var(--surface-card); border: 1px solid var(--surface-border); border-radius: var(--radius-box); overflow: hidden; box-shadow: var(--shadow-soft); }
        .xls-tab-bar { display: flex; align-items: stretch; background: var(--color-base-200); border-bottom: 1px solid var(--surface-border-strong); overflow-x: auto; scrollbar-width: none; gap: 1px; padding: 0 12px; }
        .xls-tab-bar::-webkit-scrollbar { display: none; }
        .xls-tab { display: flex; align-items: center; gap: 8px; padding: 0 20px; height: 50px; font-size: 14.5px; font-weight: 600; cursor: pointer; border: none; background: transparent; font-family: inherit; white-space: nowrap; color: var(--color-muted); border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all var(--transition-fast); flex-shrink: 0; }
        .xls-tab:hover { color: var(--color-base-content); background: var(--surface-hover); }
        .xls-tab.active { color: var(--color-primary); border-bottom-color: var(--color-primary); background: var(--surface-card); }
        .xls-tab-errbadge { min-width: 18px; height: 18px; border-radius: 9px; background: var(--color-error); color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; padding: 0 5px; }

        .xls-table-outer { overflow-x: auto; overflow-y: auto; max-height: calc(100vh - 360px); position: relative; }
        .xls-table { border-collapse: collapse; table-layout: fixed; font-size: 15px; }
        .xls-table thead { position: sticky; top: 0; z-index: 20; }
        .xls-thead-group th { background: var(--color-base-100); border-bottom: 1px solid var(--surface-border); padding: 0; height: 30px; }
        .xls-group-label { display: flex; align-items: center; gap: 6px; padding: 0 14px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--color-subtle); white-space: nowrap; height: 100%; }
        .xls-thead-cols th { background: var(--color-base-200); border-bottom: 1.5px solid var(--surface-border-strong); padding: 11px 14px; font-size: 12.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-muted); text-align: left; white-space: nowrap; }
        .xls-thead-cols th.req-col::after { content: ' *'; color: var(--color-error); font-size: 13px; }
        .xls-frozen { position: sticky; background: inherit; z-index: 10; }
        .xls-frozen::after { content: ''; position: absolute; top: 0; right: -1px; bottom: 0; width: 1px; background: var(--surface-border-strong); }
        .xls-thead-group th.xls-frozen::after, .xls-thead-cols th.xls-frozen::after { content: ''; position: absolute; top: 0; right: -1px; bottom: 0; width: 1px; background: var(--surface-border-strong); }
        .xls-thead-cols th.xls-frozen { z-index: 25; }
        .xls-thead-group th.xls-frozen { z-index: 25; }

        .xls-row { border-bottom: 1px solid var(--surface-border); transition: background var(--transition-fast); }
        .xls-row:last-child { border-bottom: none; }
        .xls-row:hover { background: var(--surface-hover); }
        .xls-row:hover .xls-frozen { background: var(--surface-hover); }
        .xls-row.row-ok { background: var(--color-success-soft); }
        .xls-row.row-ok:hover { background: oklch(93% 0.035 155); }
        .xls-row.row-ok .xls-frozen { background: var(--color-success-soft); }
        .xls-row.row-ok:hover .xls-frozen { background: oklch(93% 0.035 155); }
        .xls-row.row-err { background: var(--color-error-soft); }
        .xls-row.row-err:hover { background: oklch(93% 0.055 25); }
        .xls-row.row-err .xls-frozen { background: var(--color-error-soft); }
        .xls-row td { padding: 0; vertical-align: top; }
        .xls-row td.td-num { text-align: center; vertical-align: middle; padding: 0 8px; position: sticky; left: 0; z-index: 10; background: inherit; }
        .xls-row td.td-actions { vertical-align: middle; padding: 4px 8px; }
        .xls-rownum { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 7px; font-size: 12px; font-weight: 700; background: var(--surface-inset); color: var(--color-muted); transition: all var(--transition-fast); }
        .xls-rownum.ok { background: var(--color-success-soft); color: var(--color-success); }
        .xls-rownum.err { background: var(--color-error-soft); color: var(--color-error); }

        .xls-input { height: 44px; padding: 0 14px; background: transparent; border: none; outline: none; font-size: 15px; font-family: inherit; color: var(--color-base-content); width: 100%; transition: background var(--transition-fast), box-shadow var(--transition-fast); display: block; }
        .xls-input.xls-mono { font-size: 14.5px; font-variant-numeric: tabular-nums; letter-spacing: 0.01em; }
        .xls-input::placeholder { color: var(--color-subtle); }
        .xls-input:focus { background: var(--color-highlight); box-shadow: inset 0 0 0 2px var(--color-primary); border-radius: 4px; outline: none; }
        .xls-input-err { background: var(--color-error-soft); box-shadow: inset 0 0 0 2px var(--color-error); border-radius: 4px; }
        .xls-input-err:focus { box-shadow: inset 0 0 0 2px var(--color-error); }
        .xls-cell-err { display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: var(--color-error); padding: 3px 14px 5px; }
        .xls-checkbox { width: 19px; height: 19px; border: 1.5px solid var(--surface-border-strong); border-radius: 5px; cursor: pointer; appearance: none; background: var(--surface-card); transition: all var(--transition-fast); position: relative; }
        .xls-checkbox:checked { background: var(--color-error); border-color: var(--color-error); }
        .xls-checkbox:checked::after { content: ''; position: absolute; left: 4px; top: 1px; width: 6px; height: 10px; border: 2px solid #fff; border-top: none; border-left: none; transform: rotate(45deg); }
        .xls-row-actions { display: flex; gap: 3px; justify-content: center; }
        .xls-row-btn { width: 32px; height: 32px; border-radius: var(--radius-xs); border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--color-muted); transition: all var(--transition-fast); }
        .xls-row-btn:hover { background: var(--surface-hover); color: var(--color-base-content); }
        .xls-row-btn.del:hover { background: var(--color-error-soft); color: var(--color-error); }
        .xls-add-row { width: 100%; display: flex; align-items: center; justify-content: center; gap: 9px; padding: 14px; background: var(--surface-card); border: none; border-top: 1px dashed var(--surface-border-strong); cursor: pointer; font-size: 15px; font-weight: 600; color: var(--color-muted); font-family: inherit; transition: all var(--transition-fast); }
        .xls-add-row:hover { background: var(--surface-hover); color: var(--color-base-content); }
        .xls-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-top: 4px; }
        .xls-footer-meta { font-size: 15px; color: var(--color-muted); display: flex; align-items: center; gap: 10px; }
        .xls-footer-meta strong { color: var(--color-base-content); }
        .xls-footer-right { display: flex; gap: 8px; }

        /* ══ REVIEW — redesigned ══ */

        /* Top summary strip */
        .rv-summary {
          display: flex; align-items: center; justify-content: space-between;
          background: var(--surface-card);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-box);
          padding: 18px 24px; gap: 20px; flex-wrap: wrap;
          box-shadow: var(--shadow-xs);
        }
        .rv-summary-left { display: flex; align-items: center; gap: 14px; }
        .rv-summary-icon {
          width: 42px; height: 42px; border-radius: var(--radius-sm);
          background: var(--surface-inset);
          display: flex; align-items: center; justify-content: center;
          color: var(--color-primary); flex-shrink: 0;
        }
        .rv-summary-title { font-size: 17px; font-weight: 700; margin: 0 0 3px; }
        .rv-summary-sub { font-size: 14px; color: var(--color-muted); margin: 0; }

        /* Wrapper: sidebar + card */
        .rv-layout {
          display: flex;
          background: var(--surface-card);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-box);
          overflow: hidden;
          box-shadow: var(--shadow-soft);
        }

        /* Case list sidebar (multi-case only) */
        .rv-sidebar {
          width: 210px; flex-shrink: 0;
          border-right: 1px solid var(--surface-border);
          background: var(--color-base-200);
          display: flex; flex-direction: column;
        }
        .rv-sidebar-head {
          padding: 13px 16px 10px;
          font-size: 11px; font-weight: 800;
          text-transform: uppercase; letter-spacing: 0.09em;
          color: var(--color-subtle);
          border-bottom: 1px solid var(--surface-border);
          flex-shrink: 0;
        }
        .rv-sidebar-list { overflow-y: auto; flex: 1; }
        .rv-sidebar-item {
          display: flex; align-items: center; gap: 10px;
          padding: 11px 14px;
          border-bottom: 1px solid var(--surface-border);
          border-left: 3px solid transparent;
          background: transparent; width: 100%;
          text-align: left; font-family: inherit; cursor: pointer; border-top: none; border-right: none;
          transition: all var(--transition-fast);
        }
        .rv-sidebar-item:last-child { border-bottom: none; }
        .rv-sidebar-item:hover { background: var(--surface-hover); }
        .rv-sidebar-item.active {
          background: var(--surface-card);
          border-left-color: var(--color-primary);
        }
        .rv-sidebar-num {
          width: 24px; height: 24px; border-radius: 5px; flex-shrink: 0;
          background: var(--surface-border); color: var(--color-muted);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700;
          transition: all var(--transition-fast);
        }
        .rv-sidebar-item.active .rv-sidebar-num {
          background: var(--color-primary);
          color: var(--color-primary-content);
        }
        .rv-sidebar-info { flex: 1; min-width: 0; }
        .rv-sidebar-casenum { font-size: 12.5px; font-weight: 700; color: var(--color-base-content); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
        .rv-sidebar-name { font-size: 12px; color: var(--color-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }

        /* Content panel */
        .rv-panel {
          flex: 1; overflow-y: auto;
          max-height: calc(100vh - 310px);
        }

        /* Card */
        .rv-card { display: flex; flex-direction: column; }

        /* Hero */
        .rv-hero {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 16px; padding: 22px 26px 20px;
          border-bottom: 1px solid var(--surface-border);
          background: var(--color-base-100);
          flex-wrap: wrap;
        }
        .rv-hero-casenum {
          font-size: 12px; font-weight: 800; letter-spacing: 0.07em;
          text-transform: uppercase; color: var(--color-primary); margin-bottom: 7px;
          font-variant-numeric: tabular-nums;
        }
        .rv-hero-name { font-size: 22px; font-weight: 700; letter-spacing: -0.4px; margin-bottom: 6px; line-height: 1.2; }
        .rv-hero-charge { font-size: 15px; color: var(--color-muted); }
        .rv-hero-badges { display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap; flex-direction: column; }

        /* Badges */
        .rv-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 12px; border-radius: var(--radius-pill);
          font-size: 13px; font-weight: 700; white-space: nowrap;
        }
        .rv-badge-detained { background: var(--color-error-soft); color: var(--color-error); }
        .rv-badge-released { background: var(--color-success-soft); color: var(--color-success); }
        .rv-badge-court { background: var(--surface-inset); color: var(--color-muted); border: 1px solid var(--surface-border); font-weight: 600; font-size: 12.5px; }

        /* Body */
        .rv-body { display: flex; }
        .rv-body-main { flex: 1; min-width: 0; }

        /* Sections */
        .rv-section { padding: 18px 26px; border-bottom: 1px solid var(--surface-border); }
        .rv-section:last-child { border-bottom: none; }
        .rv-section-header {
          display: flex; align-items: center; gap: 7px;
          font-size: 11.5px; font-weight: 800;
          text-transform: uppercase; letter-spacing: 0.09em;
          color: var(--color-subtle); margin-bottom: 14px;
        }
        .rv-grid { display: grid; gap: 0; }
        .rv-grid-2 { grid-template-columns: repeat(2, 1fr); }
        .rv-grid-3 { grid-template-columns: repeat(3, 1fr); }

        .rv-field { padding: 8px 12px 8px 0; }
        .rv-field-label {
          font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.07em;
          color: var(--color-subtle); margin-bottom: 4px;
        }
        .rv-field-value { font-size: 15px; font-weight: 500; color: var(--color-base-content); line-height: 1.4; }
        .rv-field-value.rv-mono { font-variant-numeric: tabular-nums; font-size: 14.5px; }
        .rv-empty { color: var(--color-subtle); font-style: italic; font-size: 14px; }

        /* Address */
        .rv-address-line {
          font-size: 15px; color: var(--color-base-content);
          background: var(--surface-inset);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          padding: 10px 14px; line-height: 1.5;
        }

        /* Financial sidebar */
        .rv-fin-sidebar {
          width: 220px; flex-shrink: 0;
          border-left: 1px solid var(--surface-border);
          background: var(--color-base-200);
          padding: 18px 16px;
          position: sticky; top: 0; align-self: flex-start;
        }
        .rv-fin-table { display: flex; flex-direction: column; }
        .rv-fin-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 7px 8px; border-radius: var(--radius-xs);
        }
        .rv-fin-row:hover { background: var(--surface-hover); }
        .rv-fin-total {
          background: var(--surface-card);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-sm);
          margin-top: 8px; padding: 10px 10px;
        }
        .rv-fin-total:hover { background: var(--surface-hover); }
        .rv-fin-label { font-size: 12.5px; font-weight: 600; color: var(--color-muted); }
        .rv-fin-value { font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--color-base-content); }
        .rv-fin-total .rv-fin-label { font-size: 13px; font-weight: 700; color: var(--color-base-content); }
        .rv-fin-total .rv-fin-value { font-size: 15px; font-weight: 700; color: var(--color-primary); }

        /* Pager */
        .rv-pager { display: flex; align-items: center; gap: 8px; }
        .rv-pager-info { font-size: 14px; font-weight: 600; color: var(--color-muted); min-width: 50px; text-align: center; }

        /* Spinner */
        .xls-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: _xlsspin 0.65s linear infinite; flex-shrink: 0; }
        @keyframes _xlsspin { to { transform: rotate(360deg); } }
        .xls-kbd { display: inline-block; padding: 2px 7px; background: var(--surface-inset); border: 1px solid var(--surface-border-strong); border-radius: 5px; font-size: 13px; color: var(--color-muted); margin: 0 2px; }
      `}</style>

      <div className="xls-root">
        {/* ══ TOPBAR ══ */}
        <div className="xls-topbar">
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
              className="xls-main"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              <div className="xls-title-row">
                <div>
                  <h1 className="xls-title">
                    {isEdit ? "Edit Case Record" : "New Case Entries"}
                  </h1>
                  <p className="xls-subtitle">
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
                        <th
                          style={{
                            width: ROW_NUM_W,
                            position: "sticky",
                            left: 0,
                            zIndex: 25,
                            background: "var(--color-base-100)",
                          }}
                        />
                        <th
                          colSpan={FROZEN_COLS.length}
                          className="xls-frozen"
                          style={{
                            left: ROW_NUM_W,
                            background: "var(--color-base-100)",
                          }}
                        >
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
                        <th
                          style={{
                            textAlign: "center",
                            position: "sticky",
                            left: 0,
                            zIndex: 25,
                            background: "var(--color-base-200)",
                          }}
                        >
                          #
                        </th>
                        {FROZEN_COLS.map((col, fi) => {
                          const leftOffset =
                            ROW_NUM_W +
                            FROZEN_COLS.slice(0, fi).reduce(
                              (s, c) => s + c.width,
                              0,
                            );
                          return (
                            <th
                              key={col.key}
                              className={`xls-frozen${col.required ? " req-col" : ""}`}
                              style={{
                                left: leftOffset,
                                background: "var(--color-base-200)",
                              }}
                            >
                              {col.label}
                            </th>
                          );
                        })}
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
                          const hasErrors =
                            Object.keys(entry.errors).length > 0;
                          const isComplete = REQUIRED_FIELDS.every(
                            (k) =>
                              entry[k as keyof FormEntry] &&
                              String(entry[k as keyof FormEntry]).trim() !== "",
                          );
                          const rowClass = hasErrors
                            ? "row-err"
                            : isComplete
                              ? "row-ok"
                              : "";
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
                              className={`xls-row ${rowClass}`}
                            >
                              <td className="td-num">
                                <span
                                  className={`xls-rownum${hasErrors ? " err" : isComplete ? " ok" : ""}`}
                                >
                                  {isComplete && !hasErrors ? (
                                    <FiCheck size={11} strokeWidth={3} />
                                  ) : hasErrors ? (
                                    <FiAlertCircle size={11} />
                                  ) : (
                                    rowIdx + 1
                                  )}
                                </span>
                              </td>
                              {FROZEN_COLS.map((col, fi) => {
                                const leftOffset =
                                  ROW_NUM_W +
                                  FROZEN_COLS.slice(0, fi).reduce(
                                    (s, c) => s + c.width,
                                    0,
                                  );
                                return (
                                  <td
                                    key={col.key}
                                    className="xls-frozen"
                                    style={{ left: leftOffset }}
                                  >
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
                                );
                              })}
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
            /* ══ REVIEW — redesigned ══ */
            <motion.div
              key="review"
              className="xls-main"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {/* Summary strip */}
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

              {/* Case layout: sidebar + detail panel */}
              <div className="rv-layout">
                {/* Sidebar — only for multi-case */}
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

                {/* Detail panel */}
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

              {/* Footer */}
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
