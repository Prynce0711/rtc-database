"use client";

import { useSession } from "@/app/lib/authClient";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Case } from "../../generated/prisma/client";
import { type FilterOption } from "../Filter/FilterModal";
import { usePopup } from "../Popup/PopupProvider";
import CaseDetailModal from "./CaseDetailModal";
import CaseFilterModal, { type CaseFilterFilters } from "./CaseFilterModal";
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
  const isAdmin = session?.data?.user?.role === "admin";
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
  const [appliedFilters, setAppliedFilters] = useState<CaseFilterFilters>({});
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

  const handleApplyFilters = (filters: CaseFilterFilters, filtered: Case[]) => {
    setAppliedFilters(filters);
    setFilteredByAdvanced(filtered);
  };

  const handleDeleteCase = async (caseId: string) => {
    if (
      !(await statusPopup.showYesNo(
        "Are you sure you want to delete this case?",
      ))
    )
      return;
    try {
      statusPopup.showLoading("Deleting case...");
      const response = await deleteCase(caseId);
      if (!response.success) {
        statusPopup.showError("Failed to delete case");
        return;
      }
      await fetchCases();
    } catch (err) {
      statusPopup.showError(
        err instanceof Error ? err.message : "Failed to delete case",
      );
    }
  };

  const handleImportExcel = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      statusPopup.showLoading("Importing Excel...");
      const response = await uploadExcel(file);
      if (!response.success) {
        statusPopup.showError(response.error || "Failed to import Excel");
        return;
      }
      await fetchCases();
      statusPopup.showSuccess("Excel imported successfully");
    } catch (err) {
      statusPopup.showError(
        err instanceof Error ? err.message : "Failed to import Excel",
      );
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setUploading(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const result = await exportCasesExcel();
      if (!result.success) {
        statusPopup.showError(result.error || "Failed to export Excel");
        return;
      }
      if (!result.result) {
        statusPopup.showError("No data to export");
        return;
      }

      const { base64, fileName } = result.result;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }

      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      statusPopup.showError(
        err instanceof Error ? err.message : "Failed to export Excel",
      );
    } finally {
      setExporting(false);
    }
  };

  const showModal = (type: CaseModalType | null) => {
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
    <div className="min-h-screen bg-base-200">
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-base-content mb-2">
            Case Management
          </h2>
          <p className="opacity-70">Manage all court cases</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-title">Total Cases</div>
            <div className="stat-value text-primary">{stats.totalCases}</div>
          </div>
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-title">Detained</div>
            <div className="stat-value text-warning">{stats.detainedCases}</div>
          </div>
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-title">Pending Raffle</div>
            <div className="stat-value text-info">{stats.pendingCases}</div>
          </div>
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-title">Recently Filed</div>
            <div className="stat-value text-success">{stats.recentlyFiled}</div>
          </div>
        </div>

        {/* Search and Add */}
        <div className="flex gap-4 mb-6">
          <input
            type="text"
            placeholder="Search cases..."
            className="input input-bordered flex-1"
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
            className={`btn btn-outline`}
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

        {/* Cases Table */}
        <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th
                  onClick={() => handleSort("caseNumber")}
                  className="cursor-pointer"
                >
                  Case Number{" "}
                  {sortConfig.key === "caseNumber" &&
                    (sortConfig.order === "asc" ? "↑" : "↓")}
                </th>
                <th
                  onClick={() => handleSort("name")}
                  className="cursor-pointer"
                >
                  Name{" "}
                  {sortConfig.key === "name" &&
                    (sortConfig.order === "asc" ? "↑" : "↓")}
                </th>
                <th
                  onClick={() => handleSort("charge")}
                  className="cursor-pointer"
                >
                  Charge{" "}
                  {sortConfig.key === "charge" &&
                    (sortConfig.order === "asc" ? "↑" : "↓")}
                </th>
                <th
                  onClick={() => handleSort("branch")}
                  className="cursor-pointer"
                >
                  Branch{" "}
                  {sortConfig.key === "branch" &&
                    (sortConfig.order === "asc" ? "↑" : "↓")}
                </th>
                <th
                  onClick={() => handleSort("detained")}
                  className="cursor-pointer"
                >
                  Detained{" "}
                  {sortConfig.key === "detained" &&
                    (sortConfig.order === "asc" ? "↑" : "↓")}
                </th>
                <th
                  onClick={() => handleSort("dateFiled")}
                  className="cursor-pointer"
                >
                  Date Filed{" "}
                  {sortConfig.key === "dateFiled" &&
                    (sortConfig.order === "asc" ? "↑" : "↓")}
                </th>
                {isAdminOrAtty && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedCases.map((caseItem) => (
                <CaseRow
                  key={caseItem.id}
                  caseItem={caseItem}
                  setSelectedCase={setSelectedCase}
                  showModal={showModal}
                  handleDeleteCase={handleDeleteCase}
                  onRowClick={handleRowClick}
                />
              ))}
            </tbody>
          </table>
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
        <CaseFilterModal
          isOpen={filterModalOpen}
          onClose={() => setFilterModalOpen(false)}
          onApplyFilters={handleApplyFilters}
          cases={cases}
        />
      </main>
    </div>
  );
};

export default CasePage;
