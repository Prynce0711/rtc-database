import React, { useState, useMemo } from "react";
import CaseModal from "../Case/CaseModal";

// Define the Case interface
interface CaseData {
  id: number;
  branch: string;
  asstBr: string;
  caseNo: string;
  dateFilled: string;
  name: string;
  charge: string;
  infoSheet: string;
  courtDetained: string;
  consolidation: string;
  ecqNo: string;
  bond: string;
  raffleDate: string;
  committee1: string;
  committee2: string;
}

// Sample data - replace with actual data from your backend
const sampleCases: CaseData[] = [
  {
    id: 1,
    branch: "Branch 1",
    asstBr: "ASST-001",
    caseNo: "CASE-2026-001",
    dateFilled: "2026-01-15",
    name: "John Doe",
    charge: "Theft",
    infoSheet: "IS-001",
    courtDetained: "Yes",
    consolidation: "No",
    ecqNo: "ECQ-001",
    bond: "$5,000",
    raffleDate: "2026-02-01",
    committee1: "Committee A",
    committee2: "Committee B",
  },
  {
    id: 2,
    branch: "Branch 2",
    asstBr: "ASST-002",
    caseNo: "CASE-2026-002",
    dateFilled: "2026-01-20",
    name: "Jane Smith",
    charge: "Assault",
    infoSheet: "IS-002",
    courtDetained: "No",
    consolidation: "Yes",
    ecqNo: "ECQ-002",
    bond: "$10,000",
    raffleDate: "2026-02-05",
    committee1: "Committee C",
    committee2: "Committee D",
  },
  {
    id: 3,
    branch: "Branch 1",
    asstBr: "ASST-003",
    caseNo: "CASE-2026-003",
    dateFilled: "2026-01-25",
    name: "Robert Johnson",
    charge: "Fraud",
    infoSheet: "IS-003",
    courtDetained: "Yes",
    consolidation: "No",
    ecqNo: "ECQ-003",
    bond: "$15,000",
    raffleDate: "2026-02-10",
    committee1: "Committee A",
    committee2: "Committee E",
  },
];

const Cases: React.FC = () => {
  const [cases] = useState<CaseData[]>(sampleCases);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseData | null>(null);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [filters, setFilters] = useState({
    branch: "",
    charge: "",
    courtDetained: "",
  });

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
          value.toString().toLowerCase().includes(searchTerm.toLowerCase()),
        );

      const matchesBranch =
        filters.branch === "" || caseItem.branch === filters.branch;
      const matchesCharge =
        filters.charge === "" || caseItem.charge === filters.charge;
      const matchesCourtDetained =
        filters.courtDetained === "" ||
        caseItem.courtDetained === filters.courtDetained;

      return (
        matchesSearch && matchesBranch && matchesCharge && matchesCourtDetained
      );
    });
  }, [cases, searchTerm, filters]);

  // Autocomplete suggestions based on search term
  const suggestions = useMemo(() => {
    if (searchTerm.length < 2) return [];
    return cases
      .filter((caseItem) =>
        Object.values(caseItem).some((value) =>
          value.toString().toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      )
      .slice(0, 5);
  }, [cases, searchTerm]);

  const handleSearchClick = () => {
    setShowSearchModal(true);
  };

  const handleSuggestionClick = (caseItem: CaseData) => {
    setSelectedCase(caseItem);
    setShowCaseModal(true);
    setShowSearchModal(false);
    setSearchTerm("");
  };

  const handleRowClick = (caseItem: CaseData) => {
    setSelectedCase(caseItem);
    setShowCaseModal(true);
  };

  const handleResetFilters = () => {
    setFilters({
      branch: "",
      charge: "",
      courtDetained: "",
    });
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Cases Management</h1>

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
                      <div className="font-semibold">{suggestion.caseNo}</div>
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
              <span className="label-text">Court Detained</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={filters.courtDetained}
              onChange={(e) =>
                setFilters({ ...filters, courtDetained: e.target.value })
              }
            >
              <option value="">All</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
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
              <th>DATE FILLED</th>
              <th>NAME</th>
              <th>CHARGE</th>
              <th>INFO SHEET</th>
              <th>COURT DETAINED</th>
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
                  <td>{caseItem.asstBr}</td>
                  <td>{caseItem.caseNo}</td>
                  <td>{caseItem.dateFilled}</td>
                  <td>{caseItem.name}</td>
                  <td>{caseItem.charge}</td>
                  <td>{caseItem.infoSheet}</td>
                  <td>{caseItem.courtDetained}</td>
                  <td>{caseItem.consolidation}</td>
                  <td>{caseItem.ecqNo}</td>
                  <td>{caseItem.bond}</td>
                  <td>{caseItem.raffleDate}</td>
                  <td>{caseItem.committee1}</td>
                  <td>{caseItem.committee2}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={14} className="text-center py-8">
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
                        {suggestion.caseNo}
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
                          {suggestion.dateFilled}
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
    </div>
  );
};

export default Cases;
