"use client";

import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import { useMemo, useState } from "react";
import { FiChevronDown, FiChevronUp, FiSearch } from "react-icons/fi";
import Pagination from "../../Pagination/Pagination";
import { usePopup } from "../../Popup/PopupProvider";
import { AnyColumnDef, flattenColumns, isGroupColumn } from "./AnnualColumnDef";
import AnnualDrawer, { AnnualDrawerType } from "./AnnualDrawer";
import { FieldConfig } from "./AnnualFieldConfig";
import AnnualRow from "./AnnualRow";
import { AnnualStats, calcStats, sortRecords } from "./AnnualUtils";

const PAGE_SIZE = 25;

export interface AnnualTableProps<T extends Record<string, unknown>> {
  /** Display title shown in the header and drawer */
  title: string;
  /** Optional subtitle below the title */
  subtitle?: string;
  /** Current array of records (managed by the parent) */
  data: T[];
  /** Column definition array – supports flat ColumnDef and GroupColumnDef */
  columns: AnyColumnDef[];
  /** Field configs used to render the drawer form */
  fields: FieldConfig[];
  /**
   * Key of the date field used to compute Today / This Month stats.
   * Must match a property name in T.
   */
  dateKey: keyof T & string;
  /** The column key to sort by initially */
  sortDefaultKey: keyof T & string;
  /** Placeholder text for the search input */
  searchPlaceholder?: string;
  /** Called whenever data changes (add / edit / delete) */
  onChange: (data: T[]) => void;
}

function AnnualTable<T extends Record<string, unknown>>({
  title,
  subtitle,
  data,
  columns,
  fields,
  dateKey,
  sortDefaultKey,
  searchPlaceholder,
  onChange,
}: AnnualTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T;
    order: "asc" | "desc";
  }>({ key: sortDefaultKey, order: "desc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerType, setDrawerType] = useState<AnnualDrawerType | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<T | null>(null);

  const session = useSession();
  const isAdminOrAtty =
    session?.data?.user?.role === Roles.ADMIN ||
    session?.data?.user?.role === Roles.ATTY;

  const statusPopup = usePopup();

  // ---------- derived state ----------

  const stats: AnnualStats = useMemo(
    () => calcStats(data as Record<string, unknown>[], dateKey),
    [data, dateKey],
  );

  const filteredAndSorted = useMemo(() => {
    let filtered: T[] = data;
    if (searchTerm.trim()) {
      const lowered = searchTerm.toLowerCase();
      filtered = data.filter((row) =>
        Object.values(row).some((v) =>
          v?.toString().toLowerCase().includes(lowered),
        ),
      );
    }
    return sortRecords(filtered, sortConfig.key, sortConfig.order);
  }, [data, searchTerm, sortConfig]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredAndSorted.length / PAGE_SIZE),
  );

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAndSorted.slice(start, start + PAGE_SIZE);
  }, [filteredAndSorted, currentPage]);

  // ---------- handlers ----------

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
    onChange(data.filter((r) => r.id !== row.id));
    statusPopup.showSuccess("Entry deleted successfully");
  };

  const handleCreate = (newRecord: Record<string, unknown>) => {
    const nextId = Math.max(0, ...data.map((r) => (r.id as number) ?? 0)) + 1;
    onChange([{ ...newRecord, id: nextId } as unknown as T, ...data]);
  };

  const handleUpdate = (updated: Record<string, unknown>) => {
    onChange(data.map((r) => (r.id === updated.id ? (updated as T) : r)));
  };

  // ---------- helpers ----------

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

  // ---------- render ----------

  return (
    <div className="min-h-screen bg-base-100">
      <main className="w-full">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-4xl lg:text-5xl font-bold text-base-content mb-2">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xl text-base-content/70">{subtitle}</p>
          )}
        </div>

        {/* Search + Add */}
        <div className="relative mb-6">
          <div className="flex gap-4">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 text-xl z-10" />
            <input
              type="text"
              placeholder={searchPlaceholder ?? `Search ${title}…`}
              className="input input-bordered input-lg w-full pl-12 text-base"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            {isAdminOrAtty && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setSelectedRecord(null);
                  setDrawerType(AnnualDrawerType.ADD);
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Add Entry
              </button>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-l font-medium text-center">
          <div className="stat bg-base-300 rounded-lg shadow">
            <div className="text-base-content font-bold mb-5">
              TOTAL ENTRIES
            </div>
            <div className="text-5xl font-bold text-primary">{stats.total}</div>
          </div>
          <div className="stat bg-base-300 rounded-lg shadow">
            <div className="text-base-content font-bold mb-5">TODAY</div>
            <div className="text-5xl font-bold text-primary">{stats.today}</div>
          </div>
          <div className="stat bg-base-300 rounded-lg shadow">
            <div className="text-base-content font-bold mb-5">THIS MONTH</div>
            <div className="text-5xl font-bold text-primary">
              {stats.thisMonth}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-base-100 rounded-lg shadow overflow-x-auto">
          <table className="table table-compact w-full">
            <thead className="bg-base-300 text-base">
              {/* First header row */}
              <tr>
                {isAdminOrAtty && (
                  <th
                    rowSpan={hasGroups ? 2 : 1}
                    className="text-center align-middle"
                  >
                    Actions
                  </th>
                )}
                {columns.map((col, i) => {
                  if (isGroupColumn(col)) {
                    return (
                      <th
                        key={col.title + i}
                        colSpan={col.children.length}
                        className="text-center border-b border-base-200 bg-base-200"
                      >
                        {col.title}
                      </th>
                    );
                  }
                  return (
                    <th
                      key={col.key}
                      rowSpan={hasGroups ? 2 : 1}
                      className={`align-middle ${
                        col.align === "center"
                          ? "text-center"
                          : col.align === "right"
                            ? "text-right"
                            : ""
                      } ${col.sortable ? "cursor-pointer hover:bg-base-200 select-none" : ""}`}
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
                <tr>
                  {columns.flatMap((col, gi) => {
                    if (!isGroupColumn(col)) return [];
                    return col.children.map((child) => (
                      <th
                        key={child.key + gi}
                        className={`${
                          child.align === "center"
                            ? "text-center"
                            : child.align === "right"
                              ? "text-right"
                              : ""
                        } ${child.sortable ? "cursor-pointer hover:bg-base-200 select-none" : ""}`}
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

            <tbody>
              {paginated.map((row) => (
                <AnnualRow
                  key={(row as Record<string, unknown> & { id: number }).id}
                  row={row as Record<string, unknown>}
                  leafColumns={leafColumns}
                  onEdit={(r) => {
                    setSelectedRecord(r as T);
                    setDrawerType(AnnualDrawerType.EDIT);
                  }}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex justify-end">
          <Pagination
            pageCount={pageCount}
            currentPage={currentPage}
            onPageChange={(page) => {
              setCurrentPage(page);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>

        {/* Add / Edit drawer */}
        {drawerType && (
          <AnnualDrawer
            type={drawerType}
            title={title}
            fields={fields}
            onClose={() => {
              setDrawerType(null);
              setSelectedRecord(null);
            }}
            selectedRecord={selectedRecord as Record<string, unknown> | null}
            onCreate={handleCreate}
            onUpdate={handleUpdate}
          />
        )}
      </main>
    </div>
  );
}

export default AnnualTable;
