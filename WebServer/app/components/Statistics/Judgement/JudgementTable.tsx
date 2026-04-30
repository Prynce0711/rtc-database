"use client";

import Roles from "@/app/lib/Roles";
import { Pagination, usePopup } from "@rtc-database/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import AnnualRow from "../Annual/AnnualRow";
import AnnualToolbar from "../Annual/AnnualToolbar";
import JudgementAddReportPage from "./JudgementAddReportPage";
import {
  AnyColumnDef,
  ColumnDef,
  flattenColumns,
  isGroupColumn,
} from "./JudgementColumnDef";
import { FieldConfig } from "./JudgementFieldConfig";
// import JudgementViewPage from "./JudgementViewPage";
import { useSession } from "@/app/lib/authClient";

const PAGE_SIZE = 10;

export interface JudgementTableProps<T extends Record<string, unknown>> {
  title: string;
  subtitle?: string;
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
  onSelectedYearChange?: (year: string) => void;
}

function JudgementTable<T extends Record<string, unknown>>({
  title,
  subtitle,
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
  onSelectedYearChange,
}: JudgementTableProps<T>) {
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

  /* ── Selection helpers ──────────────────────────────────────────── */
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
        setTimeout(() => {
          setEditInitialData(undefined);
          setShowAddPage(true);
          onActivePageChange?.(true);
        }, 0);
      }
    }
  }, [requestAdd, isAdminOrAtty, onActivePageChange]);

  // Filter by year if provided
  const yearFilteredData = useMemo(() => {
    if (!selectedYear) return data;

    const extractYear = (value: unknown): string | null => {
      if (value instanceof Date && Number.isFinite(value.getTime())) {
        return String(value.getFullYear());
      }

      const asString = String(value ?? "").trim();
      if (!asString) return null;

      const exactYear = asString.match(/^(19|20)\d{2}$/);
      if (exactYear) return exactYear[0];

      const isoYear = asString.match(/^(19|20)\d{2}/);
      if (isoYear) return isoYear[0];

      const genericYear = asString.match(/(19|20)\d{2}/);
      return genericYear ? genericYear[0] : null;
    };

    return data.filter((row) => {
      const year = extractYear(row[dateKey]);
      if (!year) return false;
      return year === selectedYear;
    });
  }, [data, selectedYear, dateKey]);

  const emptyStateMessage = useMemo(() => {
    if (searchTerm.trim()) return "No rows match your search.";
    if (selectedYear) return `No records found for ${selectedYear}.`;
    return "No records found.";
  }, [searchTerm, selectedYear]);

  // const kpiCards: KPICard[] = useMemo(() => {
  //   const rows = yearFilteredData as Record<string, unknown>[];
  //   let totalHeard = 0;
  //   let totalDisposed = 0;
  //   let totalPDL = 0;
  //   const branchSet = new Set<string>();
  //   for (const r of rows) {
  //     totalHeard += Number(r.totalHeard) || 0;
  //     totalDisposed +=
  //       (Number(r.totalDisposed) || 0) + (Number(r.casesDisposed) || 0);
  //     totalPDL += Number(r.pdlTotal) || 0;
  //     if (r.branchNo) branchSet.add(String(r.branchNo));
  //   }
  //   return [
  //     {
  //       label: "Cases Heard",
  //       value: totalHeard,
  //       subtitle: "Total cases heard/tried",
  //       icon: Scale,
  //       delay: 0,
  //     },
  //     {
  //       label: "Cases Disposed",
  //       value: totalDisposed,
  //       subtitle: "Total cases disposed",
  //       icon: Gavel,
  //       delay: 100,
  //     },
  //     {
  //       label: "PDL Total",
  //       value: totalPDL,
  //       subtitle: "PDL/CICL total",
  //       icon: BarChart3,
  //       delay: 200,
  //     },
  //     {
  //       label: "Branches",
  //       value: branchSet.size,
  //       subtitle: "Active branches",
  //       icon: FileText,
  //       delay: 300,
  //     },
  //   ];
  // }, [yearFilteredData]);

  /* ── Search + Sort ──────────────────────────────────────────────── */
  const sortRecords = <R extends Record<string, unknown>>(
    records: R[],
    key: keyof R,
    order: "asc" | "desc",
  ): R[] => {
    return [...records].sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (aVal < bVal) return order === "asc" ? -1 : 1;
      if (aVal > bVal) return order === "asc" ? 1 : -1;
      return 0;
    });
  };

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

  const start = (currentPage - 1) * PAGE_SIZE;
  const paginated = filteredAndSorted.slice(start, start + PAGE_SIZE);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key: key as keyof T,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc",
    }));
  };

  /* ── CRUD helpers ────────────────────────────────────────────────── */
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

  const normalizedColumns = useMemo(() => {
    const defaultCivilVColumn: ColumnDef = {
      key: "civilV",
      label: "Civil V",
      align: "center",
      render: (row) =>
        (row["civilV"] as string | number | null | undefined) ?? "—",
    };

    return columns.map((col) => {
      if (!isGroupColumn(col)) return col;

      const normalizedTitle = col.title.toLowerCase();
      if (!normalizedTitle.includes("cases heard")) return col;

      const children = [...col.children];
      let civilVIndex = children.findIndex((child) => child.key === "civilV");
      const civilInCIndex = children.findIndex(
        (child) => child.key === "civilInC",
      );

      if (civilVIndex === -1) {
        const insertAt = civilInCIndex >= 0 ? civilInCIndex : 0;
        children.splice(insertAt, 0, defaultCivilVColumn);
        civilVIndex = insertAt;
      }

      if (civilInCIndex >= 0 && civilVIndex > civilInCIndex) {
        const [civilV] = children.splice(civilVIndex, 1);
        const targetIndex = children.findIndex(
          (child) => child.key === "civilInC",
        );
        children.splice(targetIndex >= 0 ? targetIndex : 0, 0, civilV);
      }

      return { ...col, children };
    });
  }, [columns]);

  const hasGroups = normalizedColumns.some(isGroupColumn);
  const leafColumns = flattenColumns(normalizedColumns);

  /* ── Column totals ──────────────────────────────────────────────── */
  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const col of leafColumns) {
      if (col.computeValue) {
        let sum = 0;
        for (const row of filteredAndSorted) {
          sum += col.computeValue(row as Record<string, unknown>);
        }
        totals[col.key] = sum;
        continue;
      }
      let sum = 0;
      let hasNumeric = false;
      for (const row of filteredAndSorted) {
        const raw = (row as Record<string, unknown>)[col.key];
        const num = Number(raw);
        if (raw != null && raw !== "" && !isNaN(num)) {
          sum += num;
          hasNumeric = true;
        }
      }
      if (hasNumeric) totals[col.key] = sum;
    }
    return totals;
  }, [filteredAndSorted, leafColumns]);

  const sortIcon = (key: string) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.order === "asc" ? (
      <FiChevronUp className="inline ml-1" />
    ) : (
      <FiChevronDown className="inline ml-1" />
    );
  };

  /* ── Sub-page: Add/Edit ─────────────────────────────────────────── */
  if (showAddPage) {
    return (
      <JudgementAddReportPage
        title={title}
        fields={fields}
        columns={normalizedColumns}
        selectedYear={selectedYear}
        initialData={editInitialData}
        onBack={() => {
          setShowAddPage(false);
          setEditInitialData(undefined);
          onActivePageChange?.(false);
        }}
        onAdd={onAdd}
        onUpdate={onUpdate}
        activeView={activeView}
        onSwitchView={onSwitchView}
        onSelectedYearChange={onSelectedYearChange}
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
      {/* ── KPI CARDS ── */}
      {/* <section className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 text-center">
        {kpiCards.map((card, idx) => (
          <div
            key={idx}
            className="card shadow-xl hover:shadow-2xl hover:scale-[1.03] transition-all duration-300 group"
            style={{ transitionDelay: `${card.delay}ms` }}
          >
            <div className="card-body p-4 sm:p-6 relative overflow-hidden">
              <div className="absolute right-0 top-0 h-32 w-32 -translate-y-8 translate-x-8 opacity-5 transition-all duration-500 group-hover:opacity-10 group-hover:scale-110">
                <card.icon className="h-full w-full" />
              </div>
              <div className="relative">
                <div className="badge border-base-100 gap-2 mb-3">
                  <span className="font-extrabold uppercase text-sm tracking-wide">
                    {card.label}
                  </span>
                </div>
                <p className="text-4xl sm:text-5xl font-black text-base-content mb-2">
                  {card.value.toLocaleString()}
                </p>
                <p className="text-sm sm:text-base font-semibold text-base-content/60">
                  {card.subtitle}
                </p>
              </div>
            </div>
          </div>
        ))}
      </section> */}
      {/* ── TOOLBAR ── */}
      <AnnualToolbar
        search={searchTerm}
        onSearchChange={(v: string) => {
          setSearchTerm(v);
          setCurrentPage(1);
        }}
        rowCount={filteredAndSorted.length}
        placeholder={searchPlaceholder ?? "Search records..."}
        selectionMode={selectionMode}
        selectedCount={selectedIds.size}
        onConfirmSelection={isAdminOrAtty ? confirmSelection : undefined}
        onCancelSelection={isAdminOrAtty ? cancelSelection : undefined}
      />
      {/* ── TABLE ── */}
      <div
        className={`bg-base-100 rounded-xl shadow-lg border border-base-300/50 overflow-hidden${
          isSelecting
            ? selectionMode === "delete"
              ? " ring-2 ring-error/30"
              : " ring-2 ring-info/30"
            : ""
        }`}
      >
        <div className="overflow-x-auto">
          <table className="table table-sm w-full [&_th]:first:pl-6 [&_td]:first:pl-6">
            <thead>
              {/* Primary header row */}
              <tr className="bg-base-300 text-base-content text-sm uppercase tracking-widest">
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
                {normalizedColumns.map((col, i) => {
                  if (isGroupColumn(col)) {
                    return (
                      <th
                        key={col.title + i}
                        colSpan={col.children.length}
                        className="py-4 px-5 text-center font-extrabold border-b border-base-200 bg-base-content/5"
                      >
                        {col.title}
                      </th>
                    );
                  }
                  return (
                    <th
                      key={col.key}
                      rowSpan={hasGroups ? 2 : 1}
                      className={`py-4 px-5 font-extrabold align-middle ${
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
                <tr className="bg-base-300/80 text-base-content text-xs uppercase tracking-widest">
                  {normalizedColumns.flatMap((col, gi) => {
                    if (!isGroupColumn(col)) return [];
                    return col.children.map((child) => (
                      <th
                        key={child.key + gi}
                        className={`py-3 px-5 font-extrabold ${
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
                    {emptyStateMessage}
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

              {/* ── Grand total row ── */}
              {filteredAndSorted.length > 0 && (
                <tr className="bg-primary text-primary-content">
                  {isSelecting && <td />}
                  {leafColumns.map((col) => {
                    const total = columnTotals[col.key];
                    const isFirstCol = col === leafColumns[0];
                    return (
                      <td
                        key={col.key}
                        className={`px-5 py-4 font-black tabular-nums text-base ${
                          col.align === "center"
                            ? "text-center"
                            : col.align === "right"
                              ? "text-right"
                              : "text-left"
                        }`}
                      >
                        {isFirstCol ? (
                          <span className="text-sm uppercase tracking-widest">
                            Grand Total
                          </span>
                        ) : total != null ? (
                          total.toLocaleString()
                        ) : (
                          ""
                        )}
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* ── PAGINATION ── */}
      <div className="flex justify-end">
        <Pagination
          pageCount={pageCount}
          currentPage={currentPage}
          onPageChange={(page) => {
            setCurrentPage(page);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </div>
      {/* ── FOOTER ── */}
      <p className="text-xs text-base-content/40 text-right">
        Showing page {currentPage} of {pageCount}
      </p>
    </div>
  );
}

export default JudgementTable;
