"use client";

import { useSession } from "@/app/lib/authClient";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiSearch } from "react-icons/fi";
import type { Case } from "../../generated/prisma/client";
import FilterModal, {
  type FilterOption,
  type FilterValues,
} from "../Filter/FilterModal";
import { usePopup } from "../Popup/PopupProvider";
import Table from "../Table/Table";
import CaseDetailModal from "./CaseDetailModal";
import NewCaseModal, { CaseModalType } from "./CaseModal";
import CaseRow from "./CaseRow";
import { deleteCase, getCases } from "./CasesActions";
import { exportCasesExcel, uploadExcel } from "./ExcelActions";
import { calculateCaseStats, sortCases } from "./Record";

type CaseFilterValues = {
  branch?: string;
  assistantBranch?: string;
  caseNumber?: string;
  name?: string;
  charge?: string;
  infoSheet?: string;
  court?: string;
  detained?: boolean;
  consolidation?: string;
  eqcNumber?: number;
  bond?: { min?: number; max?: number };
  raffleDate?: { start?: string; end?: string };
  dateFiled?: { start?: string; end?: string };
};

const CasePage: React.FC = () => {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalType, setModalType] = useState<CaseModalType | null>(null);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [caseForDetailView, setCaseForDetailView] = useState<Case | null>(null);
  const session = useSession();
  const isAdminOrAtty =
    session?.data?.user?.role === "admin" ||
    session?.data?.user?.role === "atty";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const statusPopup = usePopup();

  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Case;
    order: "asc" | "desc";
  }>({ key: "dateFiled", order: "desc" });
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<CaseFilterValues>({});
  const [filteredByAdvanced, setFilteredByAdvanced] = useState<Case[]>([]);

  const caseFilterOptions: FilterOption[] = [
    { key: "branch", label: "Branch", type: "text" },
    { key: "assistantBranch", label: "Assistant Branch", type: "text" },
    { key: "caseNumber", label: "Case Number", type: "text" },
    { key: "name", label: "Name", type: "text" },
    { key: "charge", label: "Charge", type: "text" },
    { key: "infoSheet", label: "Info Sheet", type: "text" },
    { key: "court", label: "Court", type: "text" },
    { key: "consolidation", label: "Consolidation", type: "text" },
    { key: "eqcNumber", label: "EQC Number", type: "number" },
    { key: "detained", label: "Detained", type: "checkbox" },
    { key: "bond", label: "Bond Amount", type: "range" },
    { key: "dateFiled", label: "Date Filed", type: "daterange" },
    { key: "raffleDate", label: "Raffle Date", type: "daterange" },
  ];

  // Fetch cases from API
  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      setLoading(true);
      const response = await getCases();

      if (!response.success) {
        statusPopup.showError(response.error || "Failed to fetch cases");
        return;
      }

      setCases(response.result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch cases");
      console.error("Error fetching cases:", err);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => calculateCaseStats(cases), [cases]);

  const filteredAndSortedCases = useMemo(() => {
    // Start with advanced filtered cases if filters are applied, otherwise use all cases
    const baseList = cases;

    let filtered = baseList;

    if (searchTerm) {
      filtered = baseList.filter((caseItem) =>
        Object.values(caseItem).some((value) =>
          value?.toString().toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      );
    }
    return sortCases(filtered, sortConfig.key, sortConfig.order);
  }, [cases, searchTerm, sortConfig, filteredByAdvanced]);

  const handleSort = (key: keyof Case) => {
    setSortConfig((prev) => ({
      key,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc",
    }));
  };
  const getCaseSuggestions = (key: string, inputValue: string): string[] => {
    const textFields = [
      "branch",
      "assistantBranch",
      "caseNumber",
      "name",
      "charge",
      "infoSheet",
      "court",
      "consolidation",
    ];

    if (!textFields.includes(key)) return [];

    const values = cases
      .map((c) => (c[key as keyof Case] as string | null | undefined) || "")
      .filter((v) => v.length > 0);

    const unique = Array.from(new Set(values)).sort();

    if (!inputValue) return unique;

    const lower = inputValue.toLowerCase();
    return unique.filter((v) => v.toLowerCase().includes(lower));
  };

  const applyCaseFilters = (
    filters: CaseFilterValues,
    items: Case[],
  ): Case[] => {
    return items.filter((caseItem) => {
      if (
        filters.branch &&
        !caseItem.branch.toLowerCase().includes(filters.branch.toLowerCase())
      ) {
        return false;
      }

      if (
        filters.assistantBranch &&
        !caseItem.assistantBranch
          .toLowerCase()
          .includes(filters.assistantBranch.toLowerCase())
      ) {
        return false;
      }

      if (
        filters.caseNumber &&
        !caseItem.caseNumber
          .toLowerCase()
          .includes(filters.caseNumber.toLowerCase())
      ) {
        return false;
      }

      if (
        filters.name &&
        !caseItem.name.toLowerCase().includes(filters.name.toLowerCase())
      ) {
        return false;
      }

      if (
        filters.charge &&
        !caseItem.charge.toLowerCase().includes(filters.charge.toLowerCase())
      ) {
        return false;
      }

      if (
        filters.infoSheet &&
        !caseItem.infoSheet
          .toLowerCase()
          .includes(filters.infoSheet.toLowerCase())
      ) {
        return false;
      }

      if (
        filters.court &&
        !caseItem.court.toLowerCase().includes(filters.court.toLowerCase())
      ) {
        return false;
      }

      if (
        filters.consolidation &&
        !caseItem.consolidation
          .toLowerCase()
          .includes(filters.consolidation.toLowerCase())
      ) {
        return false;
      }

      if (
        filters.eqcNumber !== undefined &&
        caseItem.eqcNumber !== filters.eqcNumber
      ) {
        return false;
      }

      if (
        filters.detained !== undefined &&
        caseItem.detained !== filters.detained
      ) {
        return false;
      }

      if (filters.bond) {
        if (
          filters.bond.min !== undefined &&
          (caseItem.bond === null || caseItem.bond < filters.bond.min)
        ) {
          return false;
        }
        if (
          filters.bond.max !== undefined &&
          (caseItem.bond === null || caseItem.bond > filters.bond.max)
        ) {
          return false;
        }
      }

      if (filters.dateFiled) {
        const caseDate = new Date(caseItem.dateFiled);
        if (
          filters.dateFiled.start &&
          caseDate < new Date(filters.dateFiled.start)
        ) {
          return false;
        }
        if (
          filters.dateFiled.end &&
          caseDate > new Date(filters.dateFiled.end)
        ) {
          return false;
        }
      }

      if (filters.raffleDate) {
        if (caseItem.raffleDate === null) {
          return false;
        }
        const caseDate = new Date(caseItem.raffleDate);
        if (
          filters.raffleDate.start &&
          caseDate < new Date(filters.raffleDate.start)
        ) {
          return false;
        }
        if (
          filters.raffleDate.end &&
          caseDate > new Date(filters.raffleDate.end)
        ) {
          return false;
        }
      }

      return true;
    });
  };

  const handleApplyFilters = (filters: FilterValues) => {
    const typed = filters as CaseFilterValues;
    const filtered = applyCaseFilters(typed, cases);
    setAppliedFilters(typed);
    setFilteredByAdvanced(filtered);
  };

  const handleDeleteCase = async (caseNumber: string) => {
    if (
      !(await statusPopup.showYesNo(
        "Are you sure you want to delete this case?",
      ))
    ) {
      return;
    }

    const result = await deleteCase(caseNumber);
    if (!result.success) {
      statusPopup.showError(result.error || "Failed to delete case");
      return;
    }

    statusPopup.showSuccess("Case deleted successfully");
    await fetchCases();
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadExcel(file);
      if (!result.success) {
        statusPopup.showError(result.error || "Failed to import cases");
      } else {
        statusPopup.showSuccess("Cases imported successfully");
        await fetchCases();
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const result = await exportCasesExcel();
      if (!result.success) {
        statusPopup.showError(result.error || "Failed to export cases");
        return;
      }

      if (!result.result) {
        statusPopup.showError("No data to export");
        return;
      }

      const { fileName, base64 } = result.result;
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const showModal = (type: CaseModalType) => {
    setModalType(type);
  };

  const handleRowClick = (caseItem: Case) => {
    setCaseForDetailView(caseItem);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span>Error: {error}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      <main className="w-full px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-4xl lg:text-5xl font-bold text-base-content mb-2">
            Case Management
          </h2>
          <p className="text-lg text-base-content/70">Manage all court cases</p>
        </div>
        {/* Search and Add */}
        <div className="flex gap-4 mb-6">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40 text-xl" />
          <input
            type="text"
            placeholder="Search cases..."
            className="input input-bordered input-lg w-full pl-12  text-base"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImportExcel}
          />
          <button
            className="btn btn-outline"
            onClick={() => setFilterModalOpen(true)}
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
          </button>
          {isAdminOrAtty && (
            <button
              className={`btn btn-outline ${uploading ? "loading" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Importing..." : "Import Excel"}
            </button>
          )}
          {isAdminOrAtty && (
            <button
              className={`btn btn-outline ${exporting ? "loading" : ""}`}
              onClick={handleExportExcel}
              disabled={exporting}
            >
              {exporting ? "Exporting..." : "Export Excel"}
            </button>
          )}
          {isAdminOrAtty && (
            <button
              className="btn btn-primary"
              onClick={() => showModal(CaseModalType.ADD)}
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
          )}
        </div>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 text-l font-medium text-center">
          <div className="stat bg-base-300 rounded-lg shadow">
            <div className="text-base font-bold text-base mb-3 mb-5">
              Total Cases
            </div>
            <div className="text-5xl font-bold text-primary">
              {stats.totalCases}
            </div>
          </div>
          <div className="stat bg-base-300 rounded-lg shadow">
            <div className="text-base font-bold text-base mb-3 mb-5">
              Detained
            </div>
            <div className="text-5xl font-bold text-primary">
              {stats.detainedCases}
            </div>
          </div>
          <div className="stat bg-base-300 rounded-lg shadow">
            <div className="text-base font-bold text-base mb-3  mb-5">
              Pending Raffle
            </div>
            <div className="text-5xl font-bold text-primary">
              {stats.pendingCases}
            </div>
          </div>
          <div className="stat bg-base-300 rounded-lg shadow">
            <div className="text-base font-bold text-base mb-3 mb-5">
              Recently Filed
            </div>
            <div className="text-5xl font-bold text-primary">
              {stats.recentlyFiled}
            </div>
          </div>
        </div>

        {/* Cases Table */}
        <div className="bg-base-100  rounded-lg shadow">
          <Table
            headers={[
              { key: "caseNumber", label: "Case Number", sortable: true },
              { key: "name", label: "Name", sortable: true, align: "center" },
              { key: "charge", label: "Charge", sortable: true },
              { key: "branch", label: "Branch", sortable: true },
              {
                key: "detained",
                label: "Detained",
                sortable: true,
                align: "center",
              },
              { key: "dateFiled", label: "Date Filed", sortable: true },
              ...(isAdminOrAtty
                ? [
                    {
                      key: "actions",
                      label: "Actions",
                      align: "center" as const,
                    },
                  ]
                : []),
            ]}
            data={filteredAndSortedCases}
            rowsPerPage={10}
            sortConfig={{
              key: sortConfig.key as string,
              order: sortConfig.order,
            }}
            onSort={(k) => handleSort(k as keyof Case)}
            renderRow={(caseItem) => (
              <CaseRow
                key={caseItem.id}
                caseItem={caseItem}
                setSelectedCase={setSelectedCase}
                showModal={showModal}
                handleDeleteCase={handleDeleteCase}
                onRowClick={handleRowClick}
              />
            )}
          />
        </div>

        {/* Add/Edit Modal */}
        {modalType && (
          <NewCaseModal
            type={modalType}
            onClose={() => setModalType(null)}
            selectedCase={selectedCase}
            onCreate={(newCase) => {
              setCases((prev) => [...prev, newCase]);
              sortCases(cases, sortConfig.key, sortConfig.order);
            }}
            onUpdate={(updatedCase) => {
              setCases((prev) =>
                prev.map((c) =>
                  c.caseNumber === updatedCase.caseNumber ? updatedCase : c,
                ),
              );
            }}
          />
        )}

        {/* Case Detail Modal */}
        {caseForDetailView && (
          <CaseDetailModal
            caseData={caseForDetailView}
            onClose={() => setCaseForDetailView(null)}
          />
        )}

        {/* Filter Modal */}
        <FilterModal
          isOpen={filterModalOpen}
          onClose={() => setFilterModalOpen(false)}
          options={caseFilterOptions}
          onApply={handleApplyFilters}
          initialValues={appliedFilters}
          getSuggestions={getCaseSuggestions}
        />
      </main>
    </div>
  );
};

export default CasePage;
