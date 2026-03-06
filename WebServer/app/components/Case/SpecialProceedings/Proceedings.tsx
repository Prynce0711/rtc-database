"use client";

import { SpecialProceeding } from "@/app/generated/prisma/browser";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import {
  FiBarChart2,
  FiDownload,
  FiFileText,
  FiLock,
  FiSearch,
  FiUpload,
  FiUsers,
} from "react-icons/fi";
import { GrFormNext, GrFormPrevious } from "react-icons/gr";
import FilterModal from "../../Filter/FilterModal";
import { FilterOption } from "../../Filter/FilterTypes";
import { usePopup } from "../../Popup/PopupProvider";
import { PageListSkeleton } from "../../Skeleton/SkeletonTable.tsx";
import {
  exportSpecialProceedingsExcel,
  uploadSpecialProceedingExcel,
} from "./ExcelActions";
import SpecialProceedingDrawer from "./SpecialProceedingDrawer";
import SpecialProceedingRow from "./SpecialProceedingRow";
import {
  deleteSpecialProceeding,
  getSpecialProceedings,
} from "./SpecialProceedingsActions";

type SPFilterValues = {
  spcNo?: string;
  raffledToBranch?: string;
  petitioners?: string;
  nature?: string;
  respondent?: string;
  dateFiled?: { start?: string; end?: string };
};

type SortableSPKey =
  | "caseNumber"
  | "raffledTo"
  | "date"
  | "petitioner"
  | "nature"
  | "respondent";
type SortConfig = { key: SortableSPKey; order: "asc" | "desc" };
type DrawerType = "ADD" | "EDIT";

const SP_FILTER_OPTIONS: FilterOption[] = [
  { key: "spcNo", label: "SPC. No.", type: "text" },
  { key: "raffledToBranch", label: "Raffled to Branch", type: "text" },
  { key: "petitioners", label: "Petitioners", type: "text" },
  { key: "nature", label: "Nature", type: "text" },
  { key: "respondent", label: "Respondent", type: "text" },
  { key: "dateFiled", label: "Date Filed", type: "daterange" },
];

const PAGE_SIZE = 25;

const applySPFilters = (
  filters: SPFilterValues,
  items: SpecialProceeding[],
): SpecialProceeding[] =>
  items.filter((c) => {
    if (
      filters.spcNo &&
      !(c.caseNumber || "").toLowerCase().includes(filters.spcNo.toLowerCase())
    )
      return false;
    if (
      filters.raffledToBranch &&
      !(c.raffledTo || "")
        .toLowerCase()
        .includes(filters.raffledToBranch.toLowerCase())
    )
      return false;
    if (
      filters.petitioners &&
      !(c.petitioner || "")
        .toLowerCase()
        .includes(filters.petitioners.toLowerCase())
    )
      return false;
    if (
      filters.nature &&
      !(c.nature || "").toLowerCase().includes(filters.nature.toLowerCase())
    )
      return false;
    if (
      filters.respondent &&
      !(c.respondent || "")
        .toLowerCase()
        .includes(filters.respondent.toLowerCase())
    )
      return false;
    if (filters.dateFiled && c.date) {
      const d = new Date(c.date);
      if (filters.dateFiled.start && d < new Date(filters.dateFiled.start))
        return false;
      if (filters.dateFiled.end && d > new Date(filters.dateFiled.end))
        return false;
    }
    return true;
  });

const SortTh = ({
  label,
  colKey,
  sortConfig,
  onSort,
}: {
  label: string;
  colKey: SortableSPKey;
  sortConfig: SortConfig;
  onSort: (k: SortableSPKey) => void;
}) => {
  const active = sortConfig.key === colKey;
  const ariaLabel = active
    ? `Sorted ${sortConfig.order === "asc" ? "ascending" : "descending"}`
    : "Not sorted";

  return (
    <th
      className="text-center cursor-pointer select-none hover:bg-base-200 transition-colors"
      onClick={() => onSort(colKey)}
      aria-sort={
        active
          ? sortConfig.order === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
      aria-label={`${label}: ${ariaLabel}`}
    >
      {label}
      {active ? (
        <span className="ml-1 text-primary" aria-hidden>
          {sortConfig.order === "asc" ? "↑" : "↓"}
        </span>
      ) : (
        <span className="opacity-30 ml-1" aria-hidden>
          ↕
        </span>
      )}
    </th>
  );
};

function PageButton({
  isActive,
  children,
  onClick,
  disabled = false,
}: {
  isActive?: boolean;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className={`join-item btn btn-sm btn-ghost ${isActive ? "btn-active" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

const Pagination: React.FC<{
  pageCount: number;
  currentPage: number;
  onPageChange?: (page: number) => void;
}> = ({ pageCount, currentPage, onPageChange }) => {
  const [activeEllipsis, setActiveEllipsis] = useState<number | null>(null);
  const [ellipsisValue, setEllipsisValue] = useState<string>("");

  const getPages = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const delta = 1;
    if (pageCount <= 1) return [1];
    const rangeStart = Math.max(2, currentPage - delta);
    const rangeEnd = Math.min(pageCount - 1, currentPage + delta);
    pages.push(1);
    if (rangeStart > 2) pages.push("...");
    for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
    if (rangeEnd < pageCount - 1) pages.push("...");
    if (pageCount > 1) pages.push(pageCount);
    return pages;
  };

  const submitEllipsis = (val?: string) => {
    const v = (val ?? ellipsisValue).trim();
    const n = Number(v);
    if (!Number.isNaN(n) && n >= 1 && n <= pageCount) onPageChange?.(n);
    setActiveEllipsis(null);
    setEllipsisValue("");
  };

  const pages = getPages();

  return (
    <div className="w-full flex justify-center py-4">
      <div className="join shadow-sm bg-base-100 rounded-lg p-1">
        {currentPage > 1 && (
          <button
            className="join-item btn btn-sm btn-ghost"
            onClick={() => onPageChange?.(Math.max(1, currentPage - 1))}
          >
            <GrFormPrevious className="w-5 h-5" />
          </button>
        )}
        {pages.map((page, index) => {
          if (page === "...") {
            if (activeEllipsis === index) {
              return (
                <div key={`ell-${index}`} className="join-item">
                  <input
                    autoFocus
                    className="input input-sm w-20 text-center"
                    value={ellipsisValue}
                    onChange={(e) => setEllipsisValue(e.target.value)}
                    onBlur={() => submitEllipsis()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitEllipsis();
                      if (e.key === "Escape") {
                        setActiveEllipsis(null);
                        setEllipsisValue("");
                      }
                    }}
                  />
                </div>
              );
            }
            return (
              <button
                key={`ell-btn-${index}`}
                className="join-item btn btn-sm btn-ghost"
                onClick={() => {
                  setActiveEllipsis(index);
                  setEllipsisValue("");
                }}
              >
                ...
              </button>
            );
          }
          return (
            <PageButton
              key={page}
              isActive={page === currentPage}
              onClick={() => onPageChange?.(page as number)}
            >
              {page}
            </PageButton>
          );
        })}
        {currentPage < pageCount && (
          <button
            className="join-item btn btn-sm btn-ghost"
            onClick={() => onPageChange?.(Math.min(pageCount, currentPage + 1))}
          >
            <GrFormNext className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

const Proceedings: React.FC = () => {
  const router = useRouter();
  const popup = usePopup();
  const [cases, setCases] = useState<SpecialProceeding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "date",
    order: "desc",
  });
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<SPFilterValues>({});
  const [drawerType, setDrawerType] = useState<DrawerType | null>(null);
  const [selectedCase, setSelectedCase] = useState<SpecialProceeding | null>(
    null,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    const result = await getSpecialProceedings();
    if (!result.success) {
      setError(result.error || "Failed to fetch cases");
      setCases([]);
    } else {
      setCases(result.result || []);
    }
    setLoading(false);
  };

  const handleSort = (key: SortableSPKey) => {
    setSortConfig((prev) => ({
      key,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc",
    }));
  };

  const handleApplyFilters = (filters: SPFilterValues) => {
    setAppliedFilters(filters);
    setCurrentPage(1);
  };

  const getSuggestions = (key: string, partial: string) => {
    const fieldMap: Record<string, keyof SpecialProceeding> = {
      spcNo: "caseNumber",
      raffledToBranch: "raffledTo",
      petitioners: "petitioner",
      nature: "nature",
      respondent: "respondent",
    };
    const field = fieldMap[key];
    if (!field) return [];
    return Array.from(
      new Set(
        cases
          .map((c) => String(c[field] ?? ""))
          .filter((v) => v.toLowerCase().includes(partial.toLowerCase())),
      ),
    ).slice(0, 10);
  };

  const filteredAndSorted = useMemo(() => {
    const filtered = applySPFilters(
      appliedFilters,
      cases.filter((c) =>
        Object.values(c).some((v) =>
          String(v).toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      ),
    );

    return [...filtered].sort((a, b) => {
      const aVal = a[sortConfig.key as keyof SpecialProceeding];
      const bVal = b[sortConfig.key as keyof SpecialProceeding];

      if (aVal == null || bVal == null) return 0;
      const aStr = aVal instanceof Date ? aVal.getTime() : String(aVal);
      const bStr = bVal instanceof Date ? bVal.getTime() : String(bVal);
      if (aStr < bStr) return sortConfig.order === "asc" ? -1 : 1;
      if (aStr > bStr) return sortConfig.order === "asc" ? 1 : -1;
      return 0;
    });
  }, [cases, searchTerm, sortConfig, appliedFilters]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredAndSorted.length / PAGE_SIZE),
  );
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAndSorted.slice(start, start + PAGE_SIZE);
  }, [filteredAndSorted, currentPage]);

  const stats = useMemo(() => {
    const total = cases.length;
    const now = new Date();
    const thisMonth = cases.filter((c) => {
      if (!c.date) return false;
      const d = new Date(c.date);
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    }).length;
    const natures = new Set(cases.map((c) => c.nature)).size;
    const branches = new Set(cases.map((c) => c.raffledTo)).size;
    return { total, thisMonth, natures, branches };
  }, [cases]);

  const activeFilterCount = Object.keys(appliedFilters).length;

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this case?")) return;
    const result = await deleteSpecialProceeding(id);
    if (!result.success) {
      popup.showError(result.error || "Failed to delete");
      return;
    }
    setCases((prev) => prev.filter((c) => c.id !== id));
    popup.showSuccess("Case deleted successfully");
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const result = await uploadSpecialProceedingExcel(file);
    if (!result.success) {
      popup.showError(result.error || "Upload failed");
    } else {
      popup.showSuccess("Cases imported successfully");
      await fetchCases();
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleExportExcel = async () => {
    setExporting(true);
    const result = await exportSpecialProceedingsExcel();
    if (!result.success) {
      popup.showError(result.error || "Export failed");
    } else {
      const link = document.createElement("a");
      link.href = `data:application/octet-stream;base64,${result.result.base64}`;
      link.download = result.result.fileName;
      link.click();
      popup.showSuccess("Cases exported successfully");
    }
    setExporting(false);
  };

  // If drawer is open, show it
  if (drawerType) {
    return (
      <SpecialProceedingDrawer
        type={drawerType}
        selectedCase={selectedCase}
        onClose={() => {
          setDrawerType(null);
          setSelectedCase(null);
        }}
        onCreate={(newProc) => setCases((prev) => [...prev, newProc])}
        onUpdate={(updatedProc) =>
          setCases((prev) =>
            prev.map((c) => (c.id === updatedProc.id ? updatedProc : c)),
          )
        }
      />
    );
  }

  if (loading) {
    return <PageListSkeleton statCards={4} tableColumns={7} tableRows={8} />;
  }

  if (error) {
    return (
      <div className="alert alert-error min-h-screen flex items-center">
        <span>Error: {error}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      <main className="w-full">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-4xl lg:text-5xl font-bold text-base-content mb-2">
            Special Proceedings Cases
          </h2>
          <p className="text-xl text-base-content/50 mt-2">
            Manage all special proceedings
          </p>
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-info/10 border border-info/20 text-info text-xs font-medium select-none">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Hover over table cells to see full details</span>
          </div>
        </div>

        {/* Search and Actions */}
        <div className="relative mb-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 text-xl" />
              <input
                type="text"
                placeholder="Search cases..."
                className="input input-bordered input-lg w-full pl-12 text-base"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <button
              className={`btn btn-outline ${activeFilterCount > 0 ? "btn-primary" : ""}`}
              onClick={() => setFilterModalOpen((prev) => !prev)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z"
                  clipRule="evenodd"
                />
              </svg>
              Filter
              {activeFilterCount > 0 && (
                <span className="badge badge-sm badge-primary ml-1">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <button
              className="btn btn-outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Importing...
                </>
              ) : (
                <>
                  <FiUpload className="h-5 w-5 mr-2" />
                  Import Excel
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportExcel}
              className="hidden"
            />

            <button
              className="btn btn-outline"
              onClick={handleExportExcel}
              disabled={exporting || cases.length === 0}
            >
              {exporting ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Exporting...
                </>
              ) : (
                <>
                  <FiDownload className="h-5 w-5 mr-2" />
                  Export Excel
                </>
              )}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setSelectedCase(null);
                setDrawerType("ADD");
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
              Add Case
            </button>
          </div>

          <FilterModal
            isOpen={filterModalOpen}
            onClose={() => setFilterModalOpen(false)}
            options={SP_FILTER_OPTIONS}
            onApply={handleApplyFilters}
            initialValues={appliedFilters}
            getSuggestions={getSuggestions}
          />
        </div>

        {/* Stats (KPI cards) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Total Cases",
              value: stats.total ?? 0,
              subtitle: `${(stats.thisMonth ?? 0).toLocaleString()} this month`,
              icon: FiBarChart2,
              delay: 0,
            },
            {
              label: "This Month",
              value: stats.thisMonth ?? 0,
              subtitle: "Last 30 days",
              icon: FiFileText,
              delay: 100,
            },
            {
              label: "Case Types",
              value: stats.natures ?? 0,
              subtitle: "Distinct types",
              icon: FiUsers,
              delay: 200,
            },
            {
              label: "Branches",
              value: stats.branches ?? 0,
              subtitle: "Active branches",
              icon: FiLock,
              delay: 300,
            },
          ].map((card, idx) => {
            const Icon = card.icon as React.ComponentType<
              React.SVGProps<SVGSVGElement>
            >;
            return (
              <div
                key={idx}
                className="transform hover:scale-105 card surface-card-hover group"
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
                    <Icon className="h-full w-full" />
                  </div>
                  <div className="relative text-center">
                    <div className="mb-3">
                      <span className="text-sm font-semibold text-muted">
                        {card.label}
                      </span>
                    </div>
                    <p className="text-4xl sm:text-5xl font-black text-base-content mb-2">
                      {card.value.toLocaleString()}
                    </p>
                    <p className="text-sm sm:text-base font-semibold text-muted">
                      {card.subtitle}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Table */}
        <div className="bg-base-100 rounded-lg shadow overflow-x-auto">
          <table className="table table-zebra w-full text-center">
            <thead className=" bg-base-300">
              <tr className="text-center">
                <th>ACTIONS</th>
                <SortTh
                  label="SPC. NO."
                  colKey="caseNumber"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="RAFFLED TO BRANCH"
                  colKey="raffledTo"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="DATE FILED"
                  colKey="date"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="PETITIONERS"
                  colKey="petitioner"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="NATURE"
                  colKey="nature"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortTh
                  label="RESPONDENT"
                  colKey="respondent"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="flex flex-col items-center justify-center py-20 text-base-content/40">
                      <div className="flex items-center justify-center mb-4">
                        <FiFileText className="w-15 h-15 opacity-50" />
                      </div>
                      <p className="text-lg font-semibold text-base-content/50">
                        NO CASES FOUND
                      </p>
                      <p className="text-sm uppercase mt-1 text-base-content/35">
                        No special proceedings match your current filters.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((c) => (
                  <SpecialProceedingRow
                    key={c.id}
                    caseItem={c}
                    onEdit={(item) => {
                      setSelectedCase(item);
                      setDrawerType("EDIT");
                    }}
                    onDelete={handleDelete}
                    onRowClick={(item) =>
                      router.push(`/user/cases/proceedings/${item.id}`)
                    }
                  />
                ))
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
      </main>
    </div>
  );
};

export default Proceedings;
