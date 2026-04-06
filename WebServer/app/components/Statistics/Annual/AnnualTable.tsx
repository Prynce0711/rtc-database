"use client";

import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import { BarChart3, FileText, Gavel, Scale } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import Pagination from "../../Pagination/Pagination";
import { usePopup } from "../../Popup/PopupProvider";
import AnnualAddReportPage from "./AnnualAddReportPage";
import { AnyColumnDef, flattenColumns, isGroupColumn } from "./AnnualColumnDef";
import { FieldConfig } from "./AnnualFieldConfig";
import AnnualRow from "./AnnualRow";
import AnnualToolbar from "./AnnualToolbar";
import { sortRecords } from "./AnnualUtils";
import AnnualViewPage from "./AnnualViewPage";

const PAGE_SIZE = 10;

export type AnnualVariant = "court" | "inventory";

type AnnualKPICardLocal = {
  label: string;
  value: number;
  subtitle: string;
  icon: React.ElementType;
  delay: number;
};
export interface AnnualTableProps<T extends Record<string, unknown>> {
  title: string;
  subtitle?: string;
  variant: AnnualVariant;
  data: T[];
  columns: AnyColumnDef[];
  fields: FieldConfig[];
  dateKey: keyof T & string;
  sortDefaultKey: keyof T & string;
  searchPlaceholder?: string;
  selectedYear?: string;
  requestAdd?: number;
  onChange: (data: T[]) => void;
  onAdd?: (record: Record<string, unknown>) => void | Promise<void>;
  onUpdate?: (record: Record<string, unknown>) => void | Promise<void>;
  onDelete?: (id: number) => void | Promise<void>;
  onActivePageChange?: (active: boolean) => void;
  activeView?: string;
  onSwitchView?: (view: string) => void;
}

function AnnualTable<T extends Record<string, unknown>>({
  title,
  subtitle,
  variant,
  data,
  columns,
  fields,
  dateKey,
  sortDefaultKey,
  searchPlaceholder,
  selectedYear,
  requestAdd,
  onChange,
  onAdd,
  onUpdate,
  onDelete,
  onActivePageChange,
  activeView,
  onSwitchView,
}: AnnualTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T;
    order: "asc" | "desc";
  }>({ key: sortDefaultKey, order: "desc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectionMode, setSelectionMode] = useState<"edit" | "delete" | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showViewPage, setShowViewPage] = useState(false);
  const [showAddPage, setShowAddPage] = useState(false);
  const [editInitialData, setEditInitialData] = useState<
    Record<string, unknown>[] | undefined
  >(undefined);

  const isSelecting = selectionMode != null;

  const session = useSession();
  const isAdminOrAtty =
    session?.data?.user?.role === Roles.ADMIN ||
    session?.data?.user?.role === Roles.STATISTICS;

  const statusPopup = usePopup();

  // ── Selection helpers ──
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const allIds = paginated
      .filter((r) => (r as Record<string, unknown>).id != null)
      .map((r) => (r as Record<string, unknown>).id as number);
    setSelectedIds((prev) => {
      const allSelected = allIds.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(allIds);
    });
  };

  const cancelSelection = () => {
    setSelectionMode(null);
    setSelectedIds(new Set());
  };

  const confirmSelection = async () => {
    if (selectedIds.size === 0) return;

    if (selectionMode === "delete") {
      if (
        !(await statusPopup.showConfirm(
          `Delete ${selectedIds.size} selected row(s)?`,
        ))
      )
        return;
      if (onDelete) {
        await Promise.all(Array.from(selectedIds).map((id) => onDelete(id)));
      } else {
        onChange(
          data.filter(
            (r) =>
              !selectedIds.has((r as Record<string, unknown>).id as number),
          ),
        );
      }
      statusPopup.showSuccess(
        `${selectedIds.size} entry(s) deleted successfully`,
      );
    } else if (selectionMode === "edit") {
      // Edit selected rows via the add/edit page
      const selectedData = data.filter((r) =>
        selectedIds.has((r as Record<string, unknown>).id as number),
      );
      if (selectedData.length > 0) {
        setEditInitialData(
          selectedData as unknown as Record<string, unknown>[],
        );
        setShowAddPage(true);
        onActivePageChange?.(true);
      }
    }

    cancelSelection();
  };

  // Open add page when parent requests it
  const prevRequestAdd = useRef(requestAdd);
  useEffect(() => {
    if (requestAdd != null && requestAdd !== prevRequestAdd.current) {
      prevRequestAdd.current = requestAdd;
      if (isAdminOrAtty) {
        setEditInitialData(undefined);
        setShowAddPage(true);
        onActivePageChange?.(true);
      }
    }
  }, [requestAdd, isAdminOrAtty]);

  // Filter by year if provided
  const yearFilteredData = useMemo(() => {
    if (!selectedYear) return data;
    return data.filter((row) => {
      const d = row[dateKey];
      if (d == null || d === "") {
        return selectedYear === String(new Date().getFullYear());
      }
      const yearValue = String(d).trim();
      if (/^\d{4}$/.test(yearValue)) {
        return yearValue === selectedYear;
      }
      return yearValue.startsWith(selectedYear);
    });
  }, [data, selectedYear, dateKey]);

  const selectedReportYear = useMemo(() => {
    const parsed = Number(selectedYear);
    if (Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2100) {
      return parsed;
    }
    return new Date().getFullYear();
  }, [selectedYear]);

  const normalizeInventoryDateToSelectedYear = useCallback(
    (value: unknown): string => {
      let month = "01";
      let day = "01";

      if (typeof value === "string") {
        const isoMatch = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
          month = isoMatch[2];
          day = isoMatch[3];
        }
      }

      if (month === "01" && day === "01" && value instanceof Date) {
        if (Number.isFinite(value.getTime())) {
          month = String(value.getMonth() + 1).padStart(2, "0");
          day = String(value.getDate()).padStart(2, "0");
        }
      }

      if (
        month === "01" &&
        day === "01" &&
        typeof value === "string" &&
        value.trim() !== ""
      ) {
        const parsedDate = new Date(value);
        if (Number.isFinite(parsedDate.getTime())) {
          month = String(parsedDate.getMonth() + 1).padStart(2, "0");
          day = String(parsedDate.getDate()).padStart(2, "0");
        }
      }

      return `${selectedReportYear}-${month}-${day}`;
    },
    [selectedReportYear],
  );

  // Compute KPI cards based on variant
  const kpiCards: AnnualKPICardLocal[] = useMemo(() => {
    const rows = yearFilteredData as Record<string, unknown>[];
    if (variant === "court") {
      let pending = 0;
      let disposed = 0;
      let grandTotal = 0;
      const branchSet = new Set<string>();
      for (const r of rows) {
        const p = Number(r.pendingLastYear) || 0;
        const ra = Number(r.RaffledOrAdded) || 0;
        const d = Number(r.Disposed) || 0;
        const pt = Number(r.pendingThisYear) || 0;
        pending += p + pt;
        disposed += d;
        grandTotal += p + ra + d + pt;
        if (r.branch) branchSet.add(String(r.branch));
      }
      return [
        {
          label: "Branches",
          value: branchSet.size,
          subtitle: "Active branches",
          icon: FileText,
          delay: 300,
        },
        {
          label: "Pending",
          value: pending,
          subtitle: "Total pending cases",
          icon: Scale,
          delay: 0,
        },
        {
          label: "Disposed",
          value: disposed,
          subtitle: "Total disposed cases",
          icon: Gavel,
          delay: 100,
        },
        // {
        //   label: "Grand Total",
        //   value: grandTotal,
        //   subtitle: "All cases combined",
        //   icon: BarChart3,
        //   delay: 200,
        // },
      ];
    }
    // inventory
    let filed = 0;
    let disposed = 0;
    let grandTotal = 0;
    const branchSet = new Set<string>();
    for (const r of rows) {
      const cf = Number(r.civilSmallClaimsFiled) || 0;
      const crf = Number(r.criminalCasesFiled) || 0;
      const cd = Number(r.civilSmallClaimsDisposed) || 0;
      const crd = Number(r.criminalCasesDisposed) || 0;
      filed += cf + crf;
      disposed += cd + crd;
      grandTotal += cf + crf + cd + crd;
      if (r.branch) branchSet.add(String(r.branch));
    }
    return [
      {
        label: "Branches",
        value: branchSet.size,
        subtitle: "Active branches",
        icon: FileText,
        delay: 300,
      },
      {
        label: "Cases Filed",
        value: filed,
        subtitle: "Total cases filed",
        icon: Scale,
        delay: 0,
      },
      {
        label: "Cases Disposed",
        value: disposed,
        subtitle: "Total cases disposed",
        icon: Gavel,
        delay: 100,
      },
      {
        label: "Grand Total",
        value: grandTotal,
        subtitle: "All cases combined",
        icon: BarChart3,
        delay: 200,
      },
    ];
  }, [yearFilteredData, variant]);

  const filteredAndSorted = useMemo(() => {
    let filtered: T[] = yearFilteredData;
    if (searchTerm.trim()) {
      const lowered = searchTerm.toLowerCase();
      filtered = yearFilteredData.filter((row) =>
        Object.values(row).some((v) =>
          v?.toString().toLowerCase().includes(lowered),
        ),
      );
    }
    return sortRecords(filtered, sortConfig.key, sortConfig.order);
  }, [yearFilteredData, searchTerm, sortConfig]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredAndSorted.length / PAGE_SIZE),
  );

  const effectiveCurrentPage = Math.min(currentPage, pageCount);
  const start = (effectiveCurrentPage - 1) * PAGE_SIZE;
  const paginated = filteredAndSorted.slice(start, start + PAGE_SIZE);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key: key as keyof T,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc",
    }));
  };

  const handleDelete = async (row: Record<string, unknown>) => {
    if (
      !(await statusPopup.showConfirm(
        "Are you sure you want to delete this entry?",
      ))
    )
      return;
    if (onDelete) {
      await onDelete(row.id as number);
    } else {
      onChange(yearFilteredData.filter((r) => r.id !== row.id));
    }
    statusPopup.showSuccess("Entry deleted successfully");
  };

  const handleCreate = async (newRecord: Record<string, unknown>) => {
    const payload: Record<string, unknown> =
      variant === "court"
        ? { ...newRecord, reportYear: selectedReportYear }
        : variant === "inventory"
          ? {
              ...newRecord,
              dateRecorded: normalizeInventoryDateToSelectedYear(
                newRecord.dateRecorded,
              ),
            }
          : newRecord;

    if (onAdd) {
      await onAdd(payload);
    } else {
      const nextId = Math.max(0, ...data.map((r) => (r.id as number) ?? 0)) + 1;
      onChange([{ ...payload, id: nextId } as unknown as T, ...data]);
    }
  };

  const handleUpdate = async (updated: Record<string, unknown>) => {
    const payload: Record<string, unknown> =
      variant === "court"
        ? { ...updated, reportYear: selectedReportYear }
        : variant === "inventory"
          ? {
              ...updated,
              dateRecorded: normalizeInventoryDateToSelectedYear(
                updated.dateRecorded,
              ),
            }
          : updated;

    if (onUpdate) {
      await onUpdate(payload);
    } else {
      onChange(data.map((r) => (r.id === payload.id ? (payload as T) : r)));
    }
  };

  const hasGroups = columns.some(isGroupColumn);
  const leafColumns = flattenColumns(columns);

  const sortIcon = (key: string) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.order === "asc" ? (
      <FiChevronUp className="inline ml-1" />
    ) : (
      <FiChevronDown className="inline ml-1" />
    );
  };

  if (showAddPage) {
    return (
      <AnnualAddReportPage
        title={title}
        fields={fields}
        columns={columns}
        selectedYear={selectedYear}
        initialData={editInitialData}
        activeView={activeView}
        onSwitchView={onSwitchView}
        onBack={() => {
          setShowAddPage(false);
          setEditInitialData(undefined);
          onActivePageChange?.(false);
        }}
        onSave={async (rows) => {
          if (editInitialData && editInitialData.length > 0) {
            // Edit mode – update existing records
            for (const record of rows) {
              await handleUpdate(record);
            }
            statusPopup.showSuccess(
              `${rows.length} entry(s) updated successfully`,
            );
          } else {
            // Add mode – create new records
            for (const record of rows) {
              await handleCreate(record);
            }
            statusPopup.showSuccess(
              `${rows.length} entry(s) added successfully`,
            );
          }
          setShowAddPage(false);
          setEditInitialData(undefined);
          onActivePageChange?.(false);
        }}
      />
    );
  }

  if (showViewPage) {
    return (
      <AnnualViewPage
        title={title}
        subtitle={subtitle}
        variant={variant}
        data={filteredAndSorted as unknown as Record<string, unknown>[]}
        columns={columns}
        selectedYear={selectedYear}
        onBack={() => {
          setShowViewPage(false);
          onActivePageChange?.(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── SUBTITLE HEADER ── */}{" "}
      <div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-base-content">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm text-base-content/60">{subtitle}</p>
        )}
      </div>
      {/* ── KPI CARDS ──
      <section className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 text-center">
        {kpiCards.map((card, idx) => {
          const isGrand = card.label === "Grand Total";
          const outerClass = isGrand
            ? "transform hover:scale-105 card bg-primary/10 shadow-lg hover:shadow-xl transition-shadow ring-1 ring-primary/20 group"
            : "transform hover:scale-105 card surface-card-hover group";

          const labelClass = isGrand
            ? "font-extrabold uppercase text-sm tracking-wide text-primary/70 mb-3"
            : "font-extrabold uppercase text-sm tracking-wide text-base-content mb-3";

          const numberClass = isGrand
            ? "text-4xl sm:text-5xl font-black text-primary mb-2"
            : "text-4xl sm:text-5xl font-black text-base-content mb-2";

          const subtitleClass = isGrand
            ? "text-sm sm:text-base font-semibold text-primary/50"
            : "text-sm sm:text-base font-semibold text-muted";

          return (
            <div
              key={idx}
              className={outerClass}
              style={{
                transitionDelay: `${card.delay}ms`,
                transition: "all 400ms cubic-bezier(0.4,0,0.2,1)",
              }}
            >
              <div
                className="card-body relative overflow-hidden"
                style={{ padding: "var(--space-card-padding)" }}
              >
                <div className="absolute right-0 top-0 h-28 w-28 -translate-y-6 translate-x-6 opacity-5 transition-all duration-500 group-hover:opacity-10 group-hover:scale-110">
                  <card.icon className="h-full w-full" />
                </div>

                <div className="relative">
                  <p className={labelClass}>{card.label}</p>
                </div>

                <p className={numberClass}>{card.value.toLocaleString()}</p>

                <p className={subtitleClass}>{card.subtitle}</p>
              </div>
            </div>
          );
        })}
      </section> */}
      {/* ── TOOLBAR ── */}
      <AnnualToolbar
        search={searchTerm}
        onSearchChange={(v: string) => {
          setSearchTerm(v);
          setCurrentPage(1);
        }}
        rowCount={filteredAndSorted.length}
        placeholder={searchPlaceholder ?? `Search ${title}…`}
        selectionMode={selectionMode}
        selectedCount={selectedIds.size}
        onStartEdit={() => {
          if (filteredAndSorted.length > 0) {
            setSelectionMode("edit");
            setSelectedIds(new Set());
          }
        }}
        onStartDelete={() => {
          if (filteredAndSorted.length > 0) {
            setSelectionMode("delete");
            setSelectedIds(new Set());
          }
        }}
        onConfirmSelection={confirmSelection}
        onCancelSelection={cancelSelection}
      />
      {/* ── EXCEL-STYLE TABLE ── */}
      <div
        className={`bg-base-100 rounded-xl shadow-lg border border-base-300/50 overflow-hidden${
          isSelecting
            ? selectionMode === "delete"
              ? " ring-2 ring-error/30"
              : " ring-2 ring-info/30"
            : " cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
        }`}
        onClick={
          isSelecting
            ? undefined
            : () => {
                setShowViewPage(true);
                onActivePageChange?.(true);
              }
        }
        title={isSelecting ? undefined : "Click to view detailed report"}
      >
        <div className="overflow-x-auto">
          <table className="table table-sm w-full [&_th]:first:pl-6 [&_td]:first:pl-6">
            <thead>
              {/* Primary header row */}
              <tr className="bg-base-200/50 border-b border-base-200 text-base-content/50 text-sm uppercase tracking-wider">
                {isSelecting && (
                  <th
                    rowSpan={hasGroups ? 2 : 1}
                    className="py-4 px-2 text-center align-middle"
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={
                        paginated.length > 0 &&
                        paginated.every((r) =>
                          selectedIds.has(
                            (r as Record<string, unknown>).id as number,
                          ),
                        )
                      }
                      onChange={toggleAll}
                    />
                  </th>
                )}
                {columns.map((col, i) => {
                  if (isGroupColumn(col)) {
                    return (
                      <th
                        key={col.title + i}
                        colSpan={col.children.length}
                        className="py-4 px-5 text-center font-bold border-b border-base-200 bg-base-content/5"
                      >
                        {col.title}
                      </th>
                    );
                  }
                  return (
                    <th
                      key={col.key}
                      rowSpan={hasGroups ? 2 : 1}
                      className={`py-4 px-5 font-bold align-middle ${
                        col.align === "center"
                          ? "text-center"
                          : col.align === "right"
                            ? "text-right"
                            : "text-left"
                      } ${col.sortable ? "cursor-pointer hover:bg-base-200/60 select-none transition-colors" : ""}`}
                      onClick={
                        col.sortable ? () => handleSort(col.key) : undefined
                      }
                    >
                      {col.label}
                      {sortIcon(col.key)}
                    </th>
                  );
                })}
              </tr>

              {/* Second header row – group children only */}
              {hasGroups && (
                <tr className="bg-base-200/30 text-base-content/50 text-xs uppercase tracking-wider">
                  {columns.flatMap((col, gi) => {
                    if (!isGroupColumn(col)) return [];
                    return col.children.map((child) => (
                      <th
                        key={child.key + gi}
                        className={`py-3 px-5 font-bold ${
                          child.align === "center"
                            ? "text-center"
                            : child.align === "right"
                              ? "text-right"
                              : "text-left"
                        } ${child.sortable ? "cursor-pointer hover:bg-base-200/60 select-none transition-colors" : ""}`}
                        onClick={
                          child.sortable
                            ? () => handleSort(child.key)
                            : undefined
                        }
                      >
                        {child.label}
                        {sortIcon(child.key)}
                      </th>
                    ));
                  })}
                </tr>
              )}
            </thead>

            <tbody className="divide-y divide-base-200">
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={leafColumns.length + (isSelecting ? 1 : 0)}
                    className="py-16 text-center text-base-content/40 text-base italic"
                  >
                    No rows match your search.
                  </td>
                </tr>
              ) : (
                paginated.map((row, idx) => (
                  <AnnualRow
                    key={(row as Record<string, unknown> & { id: number }).id}
                    row={row as Record<string, unknown>}
                    leafColumns={leafColumns}
                    onEdit={(r) => {
                      setEditInitialData([r]);
                      setShowAddPage(true);
                      onActivePageChange?.(true);
                    }}
                    onDelete={handleDelete}
                    even={idx % 2 === 0}
                    rowIndex={idx}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(
                      (row as Record<string, unknown>).id as number,
                    )}
                    onToggleSelect={() =>
                      toggleSelect(
                        (row as Record<string, unknown>).id as number,
                      )
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* ── PAGINATION ── */}
      <div className="flex justify-end">
        <Pagination
          pageCount={pageCount}
          currentPage={effectiveCurrentPage}
          onPageChange={(page) => {
            setCurrentPage(page);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </div>
      {/* ── FOOTER ── */}
      <p className="text-xs text-base-content/40 text-right">
        Showing page {effectiveCurrentPage} of {pageCount}
      </p>
    </div>
  );
}

export default AnnualTable;
