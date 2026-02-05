"use client";

import { useSession } from "@/app/lib/authClient";
import React, { useEffect, useMemo, useState } from "react";
import type { Case } from "../../generated/prisma/client";
import NewCaseModal, { CaseModalType } from "./CaseModal";
import CaseRow from "./CaseRow";
import { deleteCase, getCases } from "./CasesActions";
import { calculateCaseStats, sortCases } from "./Record";

const CasePage: React.FC = () => {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalType, setModalType] = useState<CaseModalType | null>(null);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const session = useSession();
  const isAdmin = session?.data?.user?.role === "admin";

  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Case;
    order: "asc" | "desc";
  }>({ key: "dateFiled", order: "desc" });

  // Fetch cases from API
  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      setLoading(true);
      const response = await getCases();

      if (!response.success) {
        throw new Error(response.error || "Failed to fetch cases");
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
    let filtered = cases;

    if (searchTerm) {
      filtered = cases.filter((caseItem) =>
        Object.values(caseItem).some((value) =>
          value?.toString().toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      );
    }

    return sortCases(filtered, sortConfig.key, sortConfig.order);
  }, [cases, searchTerm, sortConfig]);

  const handleSort = (key: keyof Case) => {
    setSortConfig((prev) => ({
      key,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc",
    }));
  };

  const handleDeleteCase = async (caseId: string) => {
    if (!confirm("Are you sure you want to delete this case?")) return;
    try {
      const response = await deleteCase(caseId);
      if (!response.success) {
        throw new Error("Failed to delete case");
      }
      await fetchCases();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete case");
    }
  };

  const showModal = (type: CaseModalType | null) => {
    setModalType(type);
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
          {isAdmin && (
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
                {isAdmin && <th>Actions</th>}
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
      </main>
    </div>
  );
};

export default CasePage;
