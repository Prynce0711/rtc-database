import React, { useEffect, useMemo, useState } from "react";
import type { Case } from "../../../generated/prisma/client";
import { ENDPOINTS } from "../../../lib/api";
import CaseModal from "./CaseModal";

const Cases: React.FC = () => {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [filters, setFilters] = useState({
    branch: "",
    charge: "",
    detained: "",
  });

  // Fetch cases from API
  useEffect(() => {
    const fetchCases = async () => {
      try {
        setLoading(true);
        const response = await fetch(ENDPOINTS.CASES);

        console.log("Fetch response:", response);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setCases(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch cases");
        console.error("Error fetching cases:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, []);

  // Get unique values for filters
  const uniqueBranches = useMemo(
    () => [...new Set(cases.map((c) => c.branch))],
    [cases],
  );
  const uniqueCharges = useMemo(
    () => [...new Set(cases.map((c) => c.charge))],
    [cases],
  );

  // Filter and search logic
  const filteredCases = useMemo(() => {
    return cases.filter((caseItem) => {
      const matchesSearch =
        searchTerm === "" ||
        Object.values(caseItem).some((value) =>
          value?.toString().toLowerCase().includes(searchTerm.toLowerCase()),
        );

      const matchesBranch =
        filters.branch === "" || caseItem.branch === filters.branch;
      const matchesCharge =
        filters.charge === "" || caseItem.charge === filters.charge;
      const matchesDetained =
        filters.detained === "" ||
        caseItem.detained.toString() === filters.detained;

      return matchesSearch && matchesBranch && matchesCharge && matchesDetained;
    });
  }, [cases, searchTerm, filters]);

  // Autocomplete suggestions based on search term
  const suggestions = useMemo(() => {
    if (searchTerm.length < 2) return [];
    return cases
      .filter((caseItem) =>
        Object.values(caseItem).some((value) =>
          value?.toString().toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      )
      .slice(0, 5);
  }, [cases, searchTerm]);

  const handleSearchClick = () => {
    setShowSearchModal(true);
  };

  const handleSuggestionClick = (caseItem: Case) => {
    setSelectedCase(caseItem);
    setShowCaseModal(true);
    setShowSearchModal(false);
    setSearchTerm("");
  };

  const handleRowClick = (caseItem: Case) => {
    setSelectedCase(caseItem);
    setShowCaseModal(true);
  };

  const handleResetFilters = () => {
    setFilters({
      branch: "",
      charge: "",
      detained: "",
    });
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Cases Management</h1>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="alert alert-error mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Error: {error}</span>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Search Bar */}
          <div className="mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search cases..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input input-bordered flex-1"
              />
              <button onClick={handleSearchClick} className="btn btn-primary">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                Search
              </button>
            </div>

            {/* Autocomplete Suggestions */}
            {searchTerm.length >= 2 && suggestions.length > 0 && (
              <div className="bg-base-200 rounded-lg mt-2 shadow-lg">
                <ul className="menu">
                  {suggestions.map((suggestion) => (
                    <li key={suggestion.id}>
                      <button
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="text-left"
                      >
                        <div>
                          <div className="font-semibold">
                            {suggestion.caseNumber}
                          </div>
                          <div className="text-sm opacity-70">
                            {suggestion.name} - {suggestion.charge}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="mb-6 p-4 bg-base-200 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Filters</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="label">
                  <span className="label-text">Branch</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={filters.branch}
                  onChange={(e) =>
                    setFilters({ ...filters, branch: e.target.value })
                  }
                >
                  <option value="">All Branches</option>
                  {uniqueBranches.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">
                  <span className="label-text">Charge</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={filters.charge}
                  onChange={(e) =>
                    setFilters({ ...filters, charge: e.target.value })
                  }
                >
                  <option value="">All Charges</option>
                  {uniqueCharges.map((charge) => (
                    <option key={charge} value={charge}>
                      {charge}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">
                  <span className="label-text">Detained</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={filters.detained}
                  onChange={(e) =>
                    setFilters({ ...filters, detained: e.target.value })
                  }
                >
                  <option value="">All</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleResetFilters}
                  className="btn btn-outline w-full"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto bg-base-100 rounded-lg shadow-lg">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>ASST. BR.</th>
                  <th>CASE NO.</th>
                  <th>DATE FILED</th>
                  <th>NAME</th>
                  <th>CHARGE</th>
                  <th>INFO SHEET</th>
                  <th>COURT</th>
                  <th>DETAINED</th>
                  <th>CONSOLIDATION</th>
                  <th>ECQ NO.</th>
                  <th>BOND</th>
                  <th>RAFFLE DATE</th>
                  <th>COMMITTEE 1</th>
                  <th>COMMITTEE 2</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.length > 0 ? (
                  filteredCases.map((caseItem) => (
                    <tr
                      key={caseItem.id}
                      onClick={() => handleRowClick(caseItem)}
                      className="cursor-pointer hover:bg-base-300"
                    >
                      <td>{caseItem.branch}</td>
                      <td>{caseItem.assistantBranch}</td>
                      <td>{caseItem.caseNumber}</td>
                      <td>
                        {new Date(caseItem.dateFiled).toLocaleDateString()}
                      </td>
                      <td>{caseItem.name}</td>
                      <td>{caseItem.charge}</td>
                      <td>{caseItem.infoSheet}</td>
                      <td>{caseItem.court}</td>
                      <td>
                        <span
                          className={`badge ${
                            caseItem.detained ? "badge-error" : "badge-success"
                          }`}
                        >
                          {caseItem.detained ? "Yes" : "No"}
                        </span>
                      </td>
                      <td>{caseItem.consolidation}</td>
                      <td>{caseItem.eqcNumber ?? "N/A"}</td>
                      <td>₱{caseItem.bond.toLocaleString()}</td>
                      <td>
                        {caseItem.raffleDate
                          ? new Date(caseItem.raffleDate).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td>{caseItem.committe1 ?? "N/A"}</td>
                      <td>{caseItem.committe2 ?? "N/A"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={15} className="text-center py-8">
                      No cases found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Results count */}
          <div className="mt-4 text-sm opacity-70">
            Showing {filteredCases.length} of {cases.length} cases
          </div>

          {/* Search Modal */}
          {showSearchModal && (
            <div className="modal modal-open">
              <div className="modal-box max-w-2xl">
                <h3 className="font-bold text-lg mb-4">Search Results</h3>
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Search cases..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input input-bordered w-full"
                    autoFocus
                  />
                </div>

                {searchTerm.length >= 2 ? (
                  <div className="space-y-2">
                    {suggestions.length > 0 ? (
                      suggestions.map((suggestion) => (
                        <div
                          key={suggestion.id}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="p-4 bg-base-200 rounded-lg cursor-pointer hover:bg-base-300"
                        >
                          <div className="font-semibold text-lg">
                            {suggestion.caseNumber}
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                            <div>
                              <span className="opacity-70">Name:</span>{" "}
                              {suggestion.name}
                            </div>
                            <div>
                              <span className="opacity-70">Branch:</span>{" "}
                              {suggestion.branch}
                            </div>
                            <div>
                              <span className="opacity-70">Charge:</span>{" "}
                              {suggestion.charge}
                            </div>
                            <div>
                              <span className="opacity-70">Date:</span>{" "}
                              {new Date(
                                suggestion.dateFiled,
                              ).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 opacity-70">
                        No results found
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 opacity-70">
                    Type at least 2 characters to search
                  </div>
                )}

                <div className="modal-action">
                  <button
                    onClick={() => {
                      setShowSearchModal(false);
                      setSearchTerm("");
                    }}
                    className="btn"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div
                className="modal-backdrop"
                onClick={() => {
                  setShowSearchModal(false);
                  setSearchTerm("");
                }}
              ></div>
            </div>
          )}

          {/* Case Detail Modal */}
          {showCaseModal && selectedCase && (
            <CaseModal
              caseData={selectedCase}
              onClose={() => {
                setShowCaseModal(false);
                setSelectedCase(null);
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

export default Cases;
