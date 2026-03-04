"use client";

import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import { useMemo, useState } from "react";
import { FiEdit, FiMoreHorizontal, FiSearch, FiTrash2 } from "react-icons/fi";
import Pagination from "../../Pagination/Pagination";
import { usePopup } from "../../Popup/PopupProvider";
import AnnualDrawer, { AnnualDrawerType } from "../Annual/AnnualDrawer";
import { LeafColumn } from "./JudgementColumnDef";
import { FieldConfig } from "./JudgementFieldConfig";

const PAGE_SIZE = 25;

export interface JudgementTableProps<T extends Record<string, unknown>> {
  title: string;
  subtitle?: string;
  data: T[];
  leafColumns: LeafColumn[];
  fields: FieldConfig[];
  /** JSX that builds the full <thead> including all multi-level rows */
  renderHeader: (showActions: boolean) => React.ReactNode;
  dateKey: keyof T & string;
  searchPlaceholder?: string;
  onChange: (data: T[]) => void;
  onAdd?: (record: Record<string, unknown>) => void | Promise<void>;
  onUpdate?: (record: Record<string, unknown>) => void | Promise<void>;
  onDelete?: (id: number) => void | Promise<void>;
}

function JudgementTable<T extends Record<string, unknown>>({
  title,
  subtitle,
  data,
  leafColumns,
  fields,
  renderHeader,
  dateKey,
  searchPlaceholder,
  onChange,
  onAdd,
  onUpdate,
  onDelete,
}: JudgementTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerType, setDrawerType] = useState<AnnualDrawerType | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<T | null>(null);

  const session = useSession();
  const isAdminOrAtty =
    session?.data?.user?.role === Roles.ADMIN ||
    session?.data?.user?.role === Roles.ATTY;

  const statusPopup = usePopup();

  /* ── stats ──────────────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = data.length;
    const today = new Date().toISOString().slice(0, 10);
    const nowMonth = today.slice(0, 7);
    const todayCount = data.filter(
      (r) => String(r[dateKey] ?? "").slice(0, 10) === today,
    ).length;
    const monthCount = data.filter(
      (r) => String(r[dateKey] ?? "").slice(0, 7) === nowMonth,
    ).length;
    return { total, today: todayCount, thisMonth: monthCount };
  }, [data, dateKey]);

  /* ── search + pagination ──────────────────────────────────────────── */
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const lowered = searchTerm.toLowerCase();
    return data.filter((row) =>
      Object.values(row).some((v) =>
        v?.toString().toLowerCase().includes(lowered),
      ),
    );
  }, [data, searchTerm]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  /* ── CRUD helpers ────────────────────────────────────────────────── */
  const handleDelete = async (row: Record<string, unknown>) => {
    if (
      !(await statusPopup.showConfirm(
        "Are you sure you want to delete this entry?",
      ))
    )
      return;
    try {
      if (onDelete) {
        await onDelete(row.id as number);
      } else {
        onChange(data.filter((r) => r.id !== row.id));
      }
      statusPopup.showSuccess("Entry deleted successfully");
    } catch (error) {
      statusPopup.showError(
        error instanceof Error ? error.message : "Delete failed",
      );
    }
  };

  const handleCreate = async (newRecord: Record<string, unknown>) => {
    try {
      if (onAdd) {
        await onAdd(newRecord);
      } else {
        const nextId =
          Math.max(0, ...data.map((r) => (r.id as number) ?? 0)) + 1;
        onChange([{ ...newRecord, id: nextId } as unknown as T, ...data]);
      }
      statusPopup.showSuccess("Entry created successfully");
    } catch (error) {
      statusPopup.showError(
        error instanceof Error ? error.message : "Create failed",
      );
    }
  };

  const handleUpdate = async (updated: Record<string, unknown>) => {
    try {
      if (onUpdate) {
        await onUpdate(updated);
      } else {
        onChange(data.map((r) => (r.id === updated.id ? (updated as T) : r)));
      }
      statusPopup.showSuccess("Entry updated successfully");
    } catch (error) {
      statusPopup.showError(
        error instanceof Error ? error.message : "Update failed",
      );
    }
  };

  return (
    <div className="min-h-screen bg-base-100">
      <main className="w-full">
        {/* Title */}
        <div className="mb-8">
          <h2 className="text-4xl lg:text-5xl font-bold text-base-content mb-2">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xl text-base-content/70">{subtitle}</p>
          )}
        </div>

        {/* Search + Add */}
        <div className="relative mb-6 flex gap-4">
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
            {renderHeader(isAdminOrAtty)}
            <tbody>
              {paginated.map((row) => {
                const r = row as Record<string, unknown>;
                return (
                  <tr
                    key={r.id as number}
                    className="bg-base-100 hover:bg-base-200 transition-colors text-sm"
                  >
                    {isAdminOrAtty && (
                      <td
                        className="relative text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-center">
                          <div className="dropdown dropdown-start">
                            <button
                              tabIndex={0}
                              className="btn btn-ghost btn-sm px-2"
                            >
                              <FiMoreHorizontal size={18} />
                            </button>
                            <ul
                              tabIndex={0}
                              className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-44 border border-base-200"
                              style={{ zIndex: 9999 }}
                            >
                              <li>
                                <button
                                  className="flex items-center gap-3 text-warning"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedRecord(row);
                                    setDrawerType(AnnualDrawerType.EDIT);
                                  }}
                                >
                                  <FiEdit size={16} /> Edit
                                </button>
                              </li>
                              <li>
                                <button
                                  className="flex items-center gap-3 text-error"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(r);
                                  }}
                                >
                                  <FiTrash2 size={16} /> Delete
                                </button>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </td>
                    )}
                    {leafColumns.map((col) => (
                      <td key={col.key} className="text-center">
                        {col.render(r)}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {paginated.length === 0 && (
                <tr>
                  <td
                    colSpan={leafColumns.length + (isAdminOrAtty ? 1 : 0)}
                    className="text-center py-10 text-base-content/40"
                  >
                    No records found.
                  </td>
                </tr>
              )}
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

        {/* Drawer */}
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

export default JudgementTable;
