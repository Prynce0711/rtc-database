"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePopup } from "@rtc-database/shared";
import {
  FiArrowLeft,
  FiCheck,
  FiChevronRight,
  FiEdit3,
  FiEye,
  FiSave,
  FiTrash2,
  FiUpload,
} from "react-icons/fi";
import AddRowsToolbar from "../Shared/AddRowsToolbar";
import type { SummaryRow } from "./Schema";
import {
  SUMMARY_COURT_TYPES,
  SUMMARY_MONTH_OPTIONS,
  type SummaryCourtType,
} from "./SummaryConstants";
import {
  computeSummaryTotal,
  parseSummaryWorkbook,
  toMonthKey,
} from "./SummaryImportUtils";

type EditableSummaryRow = Omit<SummaryRow, "id"> & {
  id: string;
};

export interface SumAddReportProps {
  month: string; // MM
  year: string; // YYYY
  initialCourtType?: SummaryCourtType;
  initialData?: SummaryRow[];
  onBack: () => void;
  onSave: (
    rows: SummaryRow[],
    context: {
      month: string;
      year: string;
      courtType: SummaryCourtType;
    },
  ) => void | Promise<void>;
}

const CURRENT_DATE = new Date();
const CURRENT_YEAR = String(CURRENT_DATE.getFullYear());
const CURRENT_MONTH = String(CURRENT_DATE.getMonth() + 1).padStart(2, "0");

const isMonthPart = (value: string): boolean => /^(0[1-9]|1[0-2])$/.test(value);
const isYearPart = (value: string): boolean => /^\d{4}$/.test(value);

const normalizeMonthPart = (value?: string): string =>
  value && isMonthPart(value) ? value : CURRENT_MONTH;

const normalizeYearPart = (value?: string): string =>
  value && isYearPart(value) ? value : CURRENT_YEAR;

const toMonthLabel = (year: string, month: string): string =>
  new Date(`${year}-${month}-01T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

const getDaysInMonth = (year: number, month: string): number => {
  const monthNumber = Number(month);
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber)) return 31;
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
};

const alignIsoDateToPeriod = (
  isoDate: string,
  targetYear: string,
  targetMonth: string,
): string => {
  const dayMatch = isoDate.match(/^\d{4}-\d{2}-(\d{2})$/);
  const parsedDay = dayMatch ? Number(dayMatch[1]) : 1;
  const maxDay = getDaysInMonth(Number(targetYear), targetMonth);
  const safeDay = Math.max(1, Math.min(maxDay, parsedDay));
  return `${targetYear}-${targetMonth}-${String(safeDay).padStart(2, "0")}`;
};

const trySwapMonthDayToSelectedPeriod = (
  isoDate: string,
  targetYear: string,
  targetMonth: string,
): string => {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;

  const parsedYear = Number(match[1]);
  const parsedMonth = Number(match[2]);
  const parsedDay = Number(match[3]);
  const selectedYear = Number(targetYear);
  const selectedMonth = Number(targetMonth);

  if (!Number.isInteger(selectedYear) || !Number.isInteger(selectedMonth)) {
    return isoDate;
  }

  if (parsedYear !== selectedYear) return isoDate;
  if (parsedMonth === selectedMonth) return isoDate;

  // Recover dates that were parsed as month/day but authored as day/month.
  // Example with selected month 12: 2025-01-12 should become 2025-12-01.
  if (parsedDay !== selectedMonth) return isoDate;

  const maxDay = getDaysInMonth(selectedYear, targetMonth);
  const swappedDay = Math.max(1, Math.min(maxDay, parsedMonth));
  return `${targetYear}-${targetMonth}-${String(swappedDay).padStart(2, "0")}`;
};

const createRowId = (): string => {
  if (typeof globalThis !== "undefined") {
    const cryptoApi = globalThis.crypto as Crypto | undefined;
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
      return cryptoApi.randomUUID();
    }
  }

  return `summary-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const emptyRow = (
  courtType: SummaryCourtType,
  year: string,
  month: string,
): EditableSummaryRow => ({
  id: createRowId(),
  courtType,
  reportYear: Number(year),
  raffleDate: `${year}-${month}-01`,
  branch: "",
  civilFamily: 0,
  civilOrdinary: 0,
  civilReceivedViaReraffled: 0,
  civilUnloaded: 0,
  lrcPetition: 0,
  lrcSpProc: 0,
  lrcReceivedViaReraffled: 0,
  lrcUnloaded: 0,
  criminalFamily: 0,
  criminalDrugs: 0,
  criminalOrdinary: 0,
  criminalReceivedViaReraffled: 0,
  criminalUnloaded: 0,
  total: 0,
});

const NUMERIC_FIELDS: Array<{
  key: Exclude<
    keyof EditableSummaryRow,
    "id" | "courtType" | "reportYear" | "raffleDate" | "branch"
  >;
  label: string;
  group: "civil" | "lrc" | "criminal" | "total";
}> = [
  { key: "civilFamily", label: "Family", group: "civil" },
  { key: "civilOrdinary", label: "Ordinary", group: "civil" },
  {
    key: "civilReceivedViaReraffled",
    label: "Rec'd Via Re-Raffled",
    group: "civil",
  },
  { key: "civilUnloaded", label: "UN Loaded", group: "civil" },
  { key: "lrcPetition", label: "Petition", group: "lrc" },
  { key: "lrcSpProc", label: "SP. PROC.", group: "lrc" },
  {
    key: "lrcReceivedViaReraffled",
    label: "Rec'd Via Re-Raffled",
    group: "lrc",
  },
  { key: "lrcUnloaded", label: "UN Loaded", group: "lrc" },
  { key: "criminalFamily", label: "Family", group: "criminal" },
  { key: "criminalDrugs", label: "Drugs", group: "criminal" },
  { key: "criminalOrdinary", label: "Ordinary", group: "criminal" },
  {
    key: "criminalReceivedViaReraffled",
    label: "Rec'd Via Re-Raffled",
    group: "criminal",
  },
  { key: "criminalUnloaded", label: "UN Loaded", group: "criminal" },
  { key: "total", label: "Total", group: "total" },
];

const SUMMARY_EDIT_COLUMN_WIDTHS = {
  select: 44,
  rowNumber: 44,
  branch: 176,
  raffleDate: 168,
  total: 108,
} as const;

const SUMMARY_EDIT_NUMERIC_COLUMN_WIDTHS: Record<string, number> = {
  civilFamily: 108,
  civilOrdinary: 108,
  civilReceivedViaReraffled: 148,
  civilUnloaded: 112,
  lrcPetition: 108,
  lrcSpProc: 108,
  lrcReceivedViaReraffled: 148,
  lrcUnloaded: 112,
  criminalFamily: 108,
  criminalDrugs: 108,
  criminalOrdinary: 108,
  criminalReceivedViaReraffled: 148,
  criminalUnloaded: 112,
};

const toRowTotal = (row: EditableSummaryRow): number =>
  computeSummaryTotal(row);

const toNonNegativeInt = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
};

const SumAddReport: React.FC<SumAddReportProps> = ({
  month,
  year,
  initialCourtType,
  initialData,
  onBack,
  onSave,
}) => {
  const statusPopup = usePopup();
  const resolvedInitialMonth = normalizeMonthPart(month);
  const resolvedInitialYear = normalizeYearPart(year);

  const resolvedInitialCourtType = useMemo(() => {
    if (
      initialCourtType &&
      SUMMARY_COURT_TYPES.some((court) => court.value === initialCourtType)
    ) {
      return initialCourtType;
    }

    return SUMMARY_COURT_TYPES[0]?.value ?? "STATUTORY FAMILY COURTS";
  }, [initialCourtType]);

  const [selectedCourtType, setSelectedCourtType] = useState<SummaryCourtType>(
    resolvedInitialCourtType,
  );
  const [selectedMonthFilter, setSelectedMonthFilter] =
    useState<string>(resolvedInitialMonth);
  const [selectedYearFilter, setSelectedYearFilter] =
    useState<string>(resolvedInitialYear);
  const [step, setStep] = useState<"edit" | "review">("edit");
  const [rows, setRows] = useState<EditableSummaryRow[]>(() => {
    if (initialData && initialData.length > 0) {
      return initialData.map((row) => ({
        id: createRowId(),
        courtType: row.courtType,
        reportYear: row.reportYear,
        raffleDate: row.raffleDate,
        branch: row.branch,
        civilFamily: row.civilFamily,
        civilOrdinary: row.civilOrdinary,
        civilReceivedViaReraffled: row.civilReceivedViaReraffled,
        civilUnloaded: row.civilUnloaded,
        lrcPetition: row.lrcPetition,
        lrcSpProc: row.lrcSpProc,
        lrcReceivedViaReraffled: row.lrcReceivedViaReraffled,
        lrcUnloaded: row.lrcUnloaded,
        criminalFamily: row.criminalFamily,
        criminalDrugs: row.criminalDrugs,
        criminalOrdinary: row.criminalOrdinary,
        criminalReceivedViaReraffled: row.criminalReceivedViaReraffled,
        criminalUnloaded: row.criminalUnloaded,
        total: row.total,
      }));
    }

    return [
      emptyRow(
        resolvedInitialCourtType,
        resolvedInitialYear,
        resolvedInitialMonth,
      ),
    ];
  });

  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveYearFilter = isYearPart(selectedYearFilter)
    ? selectedYearFilter
    : CURRENT_YEAR;
  const activeMonthKey = `${effectiveYearFilter}-${selectedMonthFilter}`;
  const periodLabel = toMonthLabel(effectiveYearFilter, selectedMonthFilter);

  const yearFilterOptions = useMemo(() => {
    const years = new Set<string>([CURRENT_YEAR, resolvedInitialYear]);

    rows.forEach((row) => {
      years.add(String(row.reportYear));
      if (/^\d{4}/.test(row.raffleDate)) years.add(row.raffleDate.slice(0, 4));
    });

    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [resolvedInitialYear, rows]);

  const displayedRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.courtType === selectedCourtType &&
          toMonthKey(row.raffleDate) === activeMonthKey,
      ),
    [rows, selectedCourtType, activeMonthKey],
  );

  const allRowsForPeriod = useMemo(
    () => rows.filter((row) => toMonthKey(row.raffleDate) === activeMonthKey),
    [rows, activeMonthKey],
  );

  const validRowsForPeriod = useMemo(
    () => allRowsForPeriod.filter((row) => row.branch.trim().length > 0),
    [allRowsForPeriod],
  );

  const selectedVisibleCount = useMemo(
    () => displayedRows.filter((row) => selectedRows.has(row.id)).length,
    [displayedRows, selectedRows],
  );

  const totalForPeriod = useMemo(
    () =>
      validRowsForPeriod.reduce(
        (sum, row) => sum + (row.total || toRowTotal(row)),
        0,
      ),
    [validRowsForPeriod],
  );

  useEffect(() => {
    if (!importFeedback) return;
    const timer = setTimeout(() => setImportFeedback(null), 4500);
    return () => clearTimeout(timer);
  }, [importFeedback]);

  useEffect(() => {
    setSelectedRows(new Set());
  }, [activeMonthKey, selectedCourtType]);

  const handleYearFilterChange = (value: string) => {
    setSelectedYearFilter(value.replace(/\D/g, "").slice(0, 4));
  };

  const addRows = (count: number = 1) => {
    setRows((previous) => [
      ...previous,
      ...Array.from({ length: count }, () =>
        emptyRow(selectedCourtType, effectiveYearFilter, selectedMonthFilter),
      ),
    ]);
  };

  const toggleSelectRow = (id: string) => {
    setSelectedRows((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = displayedRows.map((row) => row.id);
    setSelectedRows((previous) => {
      const next = new Set(previous);
      const allVisibleSelected = visibleIds.every((id) => next.has(id));
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const removeSelectedRows = () => {
    if (selectedRows.size === 0) return;
    setRows((previous) => previous.filter((row) => !selectedRows.has(row.id)));
    setSelectedRows(new Set());
  };

  const clearCurrentViewRows = () => {
    setRows((previous) =>
      previous.filter(
        (row) =>
          !(
            row.courtType === selectedCourtType &&
            toMonthKey(row.raffleDate) === activeMonthKey
          ),
      ),
    );
    setSelectedRows(new Set());
  };

  const updateRow = (
    id: string,
    field: keyof EditableSummaryRow,
    value: string | number,
  ) => {
    setRows((previous) =>
      previous.map((row) => {
        if (row.id !== id) return row;

        const next = {
          ...row,
          [field]: value,
        } as EditableSummaryRow;

        if (field !== "id" && field !== "total") {
          next.total = toRowTotal(next);
        }

        if (field === "raffleDate" && typeof value === "string") {
          if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            next.reportYear = Number(value.slice(0, 4));
          }
        }

        return next;
      }),
    );
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseSummaryWorkbook(
        buffer,
        Number(effectiveYearFilter),
        selectedMonthFilter,
      );

      if (parsed.rows.length === 0) {
        setImportFeedback(
          "No summary rows found. Check that the workbook contains the expected table titles and headers.",
        );
        return;
      }

      let normalizedRows = parsed.rows;
      let alignedToActivePeriod = false;
      let swappedMonthDayCount = 0;

      normalizedRows = normalizedRows.map((row) => {
        const correctedRaffleDate = trySwapMonthDayToSelectedPeriod(
          row.raffleDate,
          effectiveYearFilter,
          selectedMonthFilter,
        );

        if (correctedRaffleDate === row.raffleDate) return row;

        swappedMonthDayCount += 1;
        return {
          ...row,
          reportYear: Number(effectiveYearFilter),
          raffleDate: correctedRaffleDate,
        };
      });

      const hasRowsInActivePeriod = normalizedRows.some(
        (row) => toMonthKey(row.raffleDate) === activeMonthKey,
      );

      // Some templates carry raffle dates that do not match the selected period.
      // If nothing lands in the active month, align imported dates to the selected filter.
      if (!hasRowsInActivePeriod) {
        normalizedRows = normalizedRows.map((row) => ({
          ...row,
          reportYear: Number(effectiveYearFilter),
          raffleDate: alignIsoDateToPeriod(
            row.raffleDate,
            effectiveYearFilter,
            selectedMonthFilter,
          ),
        }));
        alignedToActivePeriod = true;
      }

      const importedRows = normalizedRows.map((row) => ({
        ...row,
        id: createRowId(),
      }));

      setRows((previous) => {
        const draft = [...previous];
        const keyed = new Map<string, EditableSummaryRow>();

        draft.forEach((row) => {
          const key = `${row.courtType}|${row.branch.toLowerCase()}|${row.raffleDate}`;
          if (row.branch.trim()) keyed.set(key, row);
        });

        importedRows.forEach((row) => {
          const key = `${row.courtType}|${row.branch.toLowerCase()}|${row.raffleDate}`;
          keyed.set(key, row);
        });

        const merged = Array.from(keyed.values());
        if (merged.length > 0) return merged;
        return importedRows;
      });

      if (parsed.detectedCourtTypes.length === 1) {
        setSelectedCourtType(parsed.detectedCourtTypes[0]);
      } else {
        const rowsForActivePeriod = normalizedRows.filter(
          (row) => toMonthKey(row.raffleDate) === activeMonthKey,
        );

        const hasVisibleRowsInSelectedCourt = rowsForActivePeriod.some(
          (row) => row.courtType === selectedCourtType,
        );

        if (!hasVisibleRowsInSelectedCourt) {
          const courtCounts = new Map<string, number>();
          rowsForActivePeriod.forEach((row) => {
            courtCounts.set(
              row.courtType,
              (courtCounts.get(row.courtType) ?? 0) + 1,
            );
          });

          const preferredCourtType = Array.from(courtCounts.entries()).sort(
            (left, right) => right[1] - left[1],
          )[0]?.[0];

          const isSupportedCourtType = SUMMARY_COURT_TYPES.some(
            (court) => court.value === preferredCourtType,
          );

          if (preferredCourtType && isSupportedCourtType) {
            setSelectedCourtType(preferredCourtType as SummaryCourtType);
          }
        }
      }

      const skippedLabel =
        parsed.skippedRows > 0
          ? ` (${parsed.skippedRows} row${parsed.skippedRows !== 1 ? "s" : ""} skipped)`
          : "";

      const alignmentLabel = alignedToActivePeriod
        ? ` Aligned raffle dates to ${periodLabel} to match the selected period.`
        : "";

      const swapLabel =
        swappedMonthDayCount > 0
          ? ` Corrected ${swappedMonthDayCount} raffle date${swappedMonthDayCount !== 1 ? "s" : ""} with day/month format into ${periodLabel}.`
          : "";

      setImportFeedback(
        `✓ Imported ${normalizedRows.length} row${normalizedRows.length !== 1 ? "s" : ""}${skippedLabel}${alignmentLabel}${swapLabel}`,
      );
    } catch (error) {
      console.error("Summary import failed:", error);
      setImportFeedback(
        "Import failed. Please check that the file is a valid Excel workbook.",
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleSave = async () => {
    const payload: SummaryRow[] = validRowsForPeriod.map((row) => {
      const reportYear = Number(row.raffleDate.slice(0, 4)) || row.reportYear;
      return {
        courtType: row.courtType,
        reportYear,
        raffleDate: row.raffleDate,
        branch: row.branch.trim(),
        civilFamily: toNonNegativeInt(row.civilFamily),
        civilOrdinary: toNonNegativeInt(row.civilOrdinary),
        civilReceivedViaReraffled: toNonNegativeInt(
          row.civilReceivedViaReraffled,
        ),
        civilUnloaded: toNonNegativeInt(row.civilUnloaded),
        lrcPetition: toNonNegativeInt(row.lrcPetition),
        lrcSpProc: toNonNegativeInt(row.lrcSpProc),
        lrcReceivedViaReraffled: toNonNegativeInt(row.lrcReceivedViaReraffled),
        lrcUnloaded: toNonNegativeInt(row.lrcUnloaded),
        criminalFamily: toNonNegativeInt(row.criminalFamily),
        criminalDrugs: toNonNegativeInt(row.criminalDrugs),
        criminalOrdinary: toNonNegativeInt(row.criminalOrdinary),
        criminalReceivedViaReraffled: toNonNegativeInt(
          row.criminalReceivedViaReraffled,
        ),
        criminalUnloaded: toNonNegativeInt(row.criminalUnloaded),
        total: toNonNegativeInt(row.total || toRowTotal(row)),
      };
    });

    if (payload.length === 0) return;

    setSaveError(null);
    setSaving(true);
    statusPopup.showLoading("Saving summary report...");
    try {
      await onSave(payload, {
        month: selectedMonthFilter,
        year: effectiveYearFilter,
        courtType: selectedCourtType,
      });
      statusPopup.showSuccess("Summary report saved successfully.");
      onBack();
    } catch (error) {
      console.error("Summary save failed:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to save summary statistics.";
      setSaveError(message);
      statusPopup.showError(message);
    } finally {
      setSaving(false);
    }
  };

  const reviewRows = useMemo(
    () =>
      validRowsForPeriod
        .slice()
        .sort(
          (left, right) =>
            left.courtType.localeCompare(right.courtType) ||
            left.raffleDate.localeCompare(right.raffleDate) ||
            left.branch.localeCompare(right.branch),
        ),
    [validRowsForPeriod],
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <button
                className="btn btn-circle btn-sm btn-ghost"
                onClick={step === "review" ? () => setStep("edit") : onBack}
                title={
                  step === "review" ? "Back to Edit" : "Back to Summary Reports"
                }
              >
                <FiArrowLeft size={16} />
              </button>

              <nav className="flex items-center gap-2 text-sm text-base-content/50">
                <span>Summary Reports</span>
                <FiChevronRight size={12} />
                <span className="font-semibold text-base-content/80">
                  {step === "edit" ? "Add Report" : "Review"}
                </span>
              </nav>
            </div>

            <div className="xls-stepper">
              <div className={`xls-step ${step === "edit" ? "active" : "done"}`}>
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

          <div className="mt-3">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-base-content">
              Add Summary Report
            </h2>
            <p className="text-sm sm:text-base text-base-content/60 mt-1.5">
              Import one Excel workbook containing multiple tables, then review
              and save rows for {periodLabel}.
            </p>
          </div>
        </div>
      </div>

      {step === "edit" ? (
        <div className="space-y-4">
          <AddRowsToolbar onAddRows={addRows}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImport}
            />
            <button
              className={`btn btn-outline btn-info gap-2${uploading ? " loading" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <FiUpload size={15} />
              {uploading ? "Importing..." : "Import Workbook"}
            </button>

            <button
              className="btn btn-error btn-outline gap-2"
              onClick={removeSelectedRows}
              disabled={selectedVisibleCount === 0}
            >
              <FiTrash2 size={15} />
              Delete Selected
              {selectedVisibleCount > 0 ? ` (${selectedVisibleCount})` : ""}
            </button>

            <button
              className="btn btn-warning btn-outline"
              onClick={clearCurrentViewRows}
            >
              Clear View
            </button>

            <div className="join ml-auto">
              <select
                className="select select-bordered join-item w-40"
                value={selectedMonthFilter}
                onChange={(event) => setSelectedMonthFilter(event.target.value)}
              >
                {SUMMARY_MONTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                list="summary-year-options"
                className="input input-bordered join-item w-28"
                value={selectedYearFilter}
                onChange={(event) => handleYearFilterChange(event.target.value)}
                placeholder={CURRENT_YEAR}
              />
              <datalist id="summary-year-options">
                {yearFilterOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </datalist>
            </div>
          </AddRowsToolbar>

          {importFeedback && (
            <div
              className={`alert ${importFeedback.startsWith("✓") ? "alert-success" : "alert-warning"} py-2`}
            >
              <span>{importFeedback}</span>
            </div>
          )}

          <div className="xls-sheet-wrap">
            <div className="xls-tab-bar">
              {SUMMARY_COURT_TYPES.map((courtType) => {
                const active = selectedCourtType === courtType.value;
                return (
                  <button
                    key={courtType.value}
                    type="button"
                    className={`xls-tab${active ? " active" : ""}`}
                    onClick={() => setSelectedCourtType(courtType.value)}
                    title={courtType.description}
                  >
                    {courtType.shortLabel}
                  </button>
                );
              })}
            </div>

            <div className="overflow-x-auto rounded-xl border border-base-200 bg-base-100">
              <table
                className="table table-pin-rows table-xs sm:table-sm w-max min-w-full"
                style={{ tableLayout: "fixed" }}
              >
                <colgroup>
                  <col style={{ width: SUMMARY_EDIT_COLUMN_WIDTHS.select }} />
                  <col
                    style={{ width: SUMMARY_EDIT_COLUMN_WIDTHS.rowNumber }}
                  />
                  <col style={{ width: SUMMARY_EDIT_COLUMN_WIDTHS.branch }} />
                  <col
                    style={{ width: SUMMARY_EDIT_COLUMN_WIDTHS.raffleDate }}
                  />
                  {NUMERIC_FIELDS.filter(
                    (field) => field.group !== "total",
                  ).map((field) => (
                    <col
                      key={field.key}
                      style={{
                        width:
                          SUMMARY_EDIT_NUMERIC_COLUMN_WIDTHS[field.key] ?? 108,
                      }}
                    />
                  ))}
                  <col style={{ width: SUMMARY_EDIT_COLUMN_WIDTHS.total }} />
                </colgroup>
                <thead>
                  <tr className="bg-base-200/70">
                    <th
                      rowSpan={2}
                      className="text-center align-middle overflow-hidden whitespace-nowrap"
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={
                          displayedRows.length > 0 &&
                          displayedRows.every((row) => selectedRows.has(row.id))
                        }
                        onChange={toggleSelectAllVisible}
                      />
                    </th>
                    <th
                      rowSpan={2}
                      className="text-center align-middle overflow-hidden whitespace-nowrap"
                    >
                      #
                    </th>
                    <th
                      rowSpan={2}
                      className="text-center align-middle overflow-hidden whitespace-nowrap"
                    >
                      Branch
                    </th>
                    <th
                      rowSpan={2}
                      className="text-center align-middle overflow-hidden whitespace-nowrap"
                    >
                      Raffle Date
                    </th>
                    <th colSpan={4} className="text-center text-primary">
                      Civil
                    </th>
                    <th colSpan={4} className="text-center text-info">
                      LRC / PET. / SPC.
                    </th>
                    <th colSpan={5} className="text-center text-success">
                      Criminal
                    </th>
                    <th
                      rowSpan={2}
                      className="text-center align-middle text-warning"
                    >
                      Total
                    </th>
                  </tr>
                  <tr className="bg-base-200/40">
                    {NUMERIC_FIELDS.filter(
                      (field) => field.group !== "total",
                    ).map((field) => (
                      <th
                        key={field.key}
                        className="text-center overflow-hidden whitespace-nowrap"
                      >
                        <span className="block truncate">{field.label}</span>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {displayedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={18}
                        className="py-12 text-center text-base-content/45"
                      >
                        No rows for {periodLabel} in {selectedCourtType}.
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map((row, index) => {
                      const computedTotal = toRowTotal(row);
                      return (
                        <tr key={row.id} className="hover:bg-base-200/30">
                          <td className="text-center">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              checked={selectedRows.has(row.id)}
                              onChange={() => toggleSelectRow(row.id)}
                            />
                          </td>
                          <td className="text-center tabular-nums">
                            {index + 1}
                          </td>

                          <td className="min-w-0">
                            <input
                              type="text"
                              className="input input-bordered input-xs sm:input-sm w-full min-w-0"
                              value={row.branch}
                              placeholder="Branch"
                              onChange={(event) =>
                                updateRow(row.id, "branch", event.target.value)
                              }
                            />
                          </td>

                          <td className="min-w-0">
                            <input
                              type="date"
                              className="input input-bordered input-xs sm:input-sm w-full min-w-0"
                              value={row.raffleDate}
                              onChange={(event) =>
                                updateRow(
                                  row.id,
                                  "raffleDate",
                                  event.target.value,
                                )
                              }
                            />
                          </td>

                          {NUMERIC_FIELDS.filter(
                            (field) => field.group !== "total",
                          ).map((field) => (
                            <td key={field.key} className="text-center min-w-0">
                              <input
                                type="number"
                                min={0}
                                className="input input-bordered input-xs sm:input-sm w-full min-w-0 text-center"
                                value={row[field.key] || ""}
                                onChange={(event) =>
                                  updateRow(
                                    row.id,
                                    field.key,
                                    toNonNegativeInt(event.target.value),
                                  )
                                }
                              />
                            </td>
                          ))}

                          <td className="text-center font-bold tabular-nums">
                            {(row.total || computedTotal).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-base-content/60">
            <p>
              {displayedRows.length} row{displayedRows.length !== 1 ? "s" : ""}{" "}
              shown for {selectedCourtType} ({periodLabel})
            </p>
            <div className="flex items-center gap-3">
              <span>
                {validRowsForPeriod.length} valid row
                {validRowsForPeriod.length !== 1 ? "s" : ""} this period
              </span>
              <button
                className="btn btn-primary gap-2"
                onClick={() => setStep("review")}
                disabled={validRowsForPeriod.length === 0}
              >
                <FiEye size={15} />
                Review
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {saveError && (
            <div className="alert alert-error py-2">
              <span>{saveError}</span>
            </div>
          )}

          <div className="card bg-base-100 border border-base-200">
            <div className="card-body p-4 sm:p-5">
              <h3 className="text-2xl sm:text-3xl font-black text-base-content">
                Review {validRowsForPeriod.length} row
                {validRowsForPeriod.length !== 1 ? "s" : ""} for {periodLabel}
              </h3>
              <p className="text-base-content/60">
                Confirm the imported and edited values before saving to Summary
                Statistics.
              </p>
              <div className="mt-2 text-sm font-semibold text-base-content/75">
                Grand Total: {totalForPeriod.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-base-200 bg-base-100">
            <table className="table table-xs sm:table-sm w-max min-w-full">
              <thead>
                <tr className="bg-base-200/70">
                  <th>#</th>
                  <th>Court Type</th>
                  <th>Branch</th>
                  <th>Raffle Date</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {reviewRows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="tabular-nums">{index + 1}</td>
                    <td>{row.courtType}</td>
                    <td>{row.branch}</td>
                    <td>{row.raffleDate}</td>
                    <td className="text-right tabular-nums font-semibold">
                      {(row.total || toRowTotal(row)).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              className="btn btn-ghost gap-2"
              onClick={() => setStep("edit")}
            >
              <FiArrowLeft size={15} />
              Back to Edit
            </button>

            <button
              className={`btn btn-success gap-2${saving ? " loading" : ""}`}
              onClick={handleSave}
              disabled={saving || validRowsForPeriod.length === 0}
            >
              <FiSave size={16} />
              {saving ? "Saving..." : "Confirm & Save"}
              {!saving && (
                <span>
                  ({validRowsForPeriod.length} row
                  {validRowsForPeriod.length !== 1 ? "s" : ""})
                </span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SumAddReport;
