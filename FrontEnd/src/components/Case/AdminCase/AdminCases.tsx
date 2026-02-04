import React, { useEffect, useMemo, useState } from "react";
import type { Case } from "../../../generated/prisma/client";
import { ENDPOINTS } from "../../../lib/api";
import {
  CaseFormData,
  initialCaseFormData,
  validateCaseForm,
} from "./CaseForms";
import { sortCases } from "./Record";

const AdminCases: React.FC = () => {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [formData, setFormData] = useState<CaseFormData>(initialCaseFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
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
      const response = await fetch(ENDPOINTS.CASES);

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

  const handleAddCase = () => {
    setFormData(initialCaseFormData);
    setFormErrors({});
    setShowAddModal(true);
  };

  const handleEditCase = (caseItem: Case) => {
    setSelectedCase(caseItem);
    setFormData({
      branch: caseItem.branch,
      assistantBranch: caseItem.assistantBranch,
      caseNumber: caseItem.caseNumber,
      dateFiled: new Date(caseItem.dateFiled),
      name: caseItem.name,
      charge: caseItem.charge,
      infoSheet: caseItem.infoSheet,
      court: caseItem.court,
      detained: caseItem.detained,
      consolidation: caseItem.consolidation,
      eqcNumber: caseItem.eqcNumber ?? undefined,
      bond: caseItem.bond,
      raffleDate: caseItem.raffleDate
        ? new Date(caseItem.raffleDate)
        : undefined,
      committe1: caseItem.committe1 ?? undefined,
      committe2: caseItem.committe2 ?? undefined,
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleDeleteCase = async (id: number) => {
    if (!confirm("Are you sure you want to delete this case?")) return;

    try {
      const response = await fetch(`${ENDPOINTS.CASES}/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete case");
      }

      await fetchCases();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete case");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validateCaseForm(formData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      const url =
        showEditModal && selectedCase
          ? `${ENDPOINTS.CASES}/${selectedCase.id}`
          : ENDPOINTS.CASES;

      const response = await fetch(url, {
        method: showEditModal ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          dateFiled: formData.dateFiled.toISOString(),
          raffleDate: formData.raffleDate?.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to ${showEditModal ? "update" : "create"} case`,
        );
      }

      await fetchCases();
      setShowAddModal(false);
      setShowEditModal(false);
      setSelectedCase(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save case");
    }
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

        {/* Search and Add */}
        <div className="flex gap-4 mb-6">
          <input
            type="text"
            placeholder="Search cases..."
            className="input input-bordered flex-1"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button className="btn btn-primary" onClick={handleAddCase}>
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedCases.map((caseItem) => (
                <tr key={caseItem.id}>
                  <td>{caseItem.caseNumber}</td>
                  <td>{caseItem.name}</td>
                  <td>{caseItem.charge}</td>
                  <td>{caseItem.branch}</td>
                  <td>
                    <span
                      className={`badge ${
                        caseItem.detained ? "badge-warning" : "badge-success"
                      }`}
                    >
                      {caseItem.detained ? "Yes" : "No"}
                    </span>
                  </td>
                  <td>{new Date(caseItem.dateFiled).toLocaleDateString()}</td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => handleEditCase(caseItem)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-error btn-ghost"
                        onClick={() => handleDeleteCase(caseItem.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add/Edit Modal */}
        {(showAddModal || showEditModal) && (
          <dialog className="modal modal-open">
            <div className="modal-box max-w-3xl">
              <h3 className="font-bold text-lg mb-4">
                {showEditModal ? "Edit Case" : "Add New Case"}
              </h3>
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-2 gap-4">
                  {/* Branch */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Branch *</span>
                    </label>
                    <input
                      type="text"
                      className={`input input-bordered ${formErrors.branch ? "input-error" : ""}`}
                      value={formData.branch}
                      onChange={(e) =>
                        setFormData({ ...formData, branch: e.target.value })
                      }
                    />
                    {formErrors.branch && (
                      <label className="label">
                        <span className="label-text-alt text-error">
                          {formErrors.branch}
                        </span>
                      </label>
                    )}
                  </div>

                  {/* Assistant Branch */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Assistant Branch *</span>
                    </label>
                    <input
                      type="text"
                      className={`input input-bordered ${formErrors.assistantBranch ? "input-error" : ""}`}
                      value={formData.assistantBranch}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          assistantBranch: e.target.value,
                        })
                      }
                    />
                    {formErrors.assistantBranch && (
                      <label className="label">
                        <span className="label-text-alt text-error">
                          {formErrors.assistantBranch}
                        </span>
                      </label>
                    )}
                  </div>

                  {/* Case Number */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Case Number *</span>
                    </label>
                    <input
                      type="text"
                      className={`input input-bordered ${formErrors.caseNumber ? "input-error" : ""}`}
                      value={formData.caseNumber}
                      onChange={(e) =>
                        setFormData({ ...formData, caseNumber: e.target.value })
                      }
                    />
                    {formErrors.caseNumber && (
                      <label className="label">
                        <span className="label-text-alt text-error">
                          {formErrors.caseNumber}
                        </span>
                      </label>
                    )}
                  </div>

                  {/* Name */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Name *</span>
                    </label>
                    <input
                      type="text"
                      className={`input input-bordered ${formErrors.name ? "input-error" : ""}`}
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                    {formErrors.name && (
                      <label className="label">
                        <span className="label-text-alt text-error">
                          {formErrors.name}
                        </span>
                      </label>
                    )}
                  </div>

                  {/* Charge */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Charge *</span>
                    </label>
                    <input
                      type="text"
                      className={`input input-bordered ${formErrors.charge ? "input-error" : ""}`}
                      value={formData.charge}
                      onChange={(e) =>
                        setFormData({ ...formData, charge: e.target.value })
                      }
                    />
                    {formErrors.charge && (
                      <label className="label">
                        <span className="label-text-alt text-error">
                          {formErrors.charge}
                        </span>
                      </label>
                    )}
                  </div>

                  {/* Info Sheet */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Info Sheet *</span>
                    </label>
                    <input
                      type="text"
                      className={`input input-bordered ${formErrors.infoSheet ? "input-error" : ""}`}
                      value={formData.infoSheet}
                      onChange={(e) =>
                        setFormData({ ...formData, infoSheet: e.target.value })
                      }
                    />
                    {formErrors.infoSheet && (
                      <label className="label">
                        <span className="label-text-alt text-error">
                          {formErrors.infoSheet}
                        </span>
                      </label>
                    )}
                  </div>

                  {/* Court */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Court *</span>
                    </label>
                    <input
                      type="text"
                      className={`input input-bordered ${formErrors.court ? "input-error" : ""}`}
                      value={formData.court}
                      onChange={(e) =>
                        setFormData({ ...formData, court: e.target.value })
                      }
                    />
                    {formErrors.court && (
                      <label className="label">
                        <span className="label-text-alt text-error">
                          {formErrors.court}
                        </span>
                      </label>
                    )}
                  </div>

                  {/* Consolidation */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Consolidation *</span>
                    </label>
                    <input
                      type="text"
                      className={`input input-bordered ${formErrors.consolidation ? "input-error" : ""}`}
                      value={formData.consolidation}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          consolidation: e.target.value,
                        })
                      }
                    />
                    {formErrors.consolidation && (
                      <label className="label">
                        <span className="label-text-alt text-error">
                          {formErrors.consolidation}
                        </span>
                      </label>
                    )}
                  </div>

                  {/* Date Filed */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Date Filed *</span>
                    </label>
                    <input
                      type="date"
                      className="input input-bordered"
                      value={formData.dateFiled.toISOString().split("T")[0]}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dateFiled: new Date(e.target.value),
                        })
                      }
                    />
                  </div>

                  {/* Bond */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Bond *</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className={`input input-bordered ${formErrors.bond ? "input-error" : ""}`}
                      value={formData.bond}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bond: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                    {formErrors.bond && (
                      <label className="label">
                        <span className="label-text-alt text-error">
                          {formErrors.bond}
                        </span>
                      </label>
                    )}
                  </div>

                  {/* Detained */}
                  <div className="form-control">
                    <label className="label cursor-pointer justify-start gap-4">
                      <span className="label-text">Detained</span>
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={formData.detained}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            detained: e.target.checked,
                          })
                        }
                      />
                    </label>
                  </div>

                  {/* Raffle Date */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Raffle Date</span>
                    </label>
                    <input
                      type="date"
                      className="input input-bordered"
                      value={
                        formData.raffleDate?.toISOString().split("T")[0] || ""
                      }
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          raffleDate: e.target.value
                            ? new Date(e.target.value)
                            : undefined,
                        })
                      }
                    />
                  </div>

                  {/* EQC Number */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">EQC Number</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered"
                      value={formData.eqcNumber || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          eqcNumber: e.target.value
                            ? parseInt(e.target.value)
                            : undefined,
                        })
                      }
                    />
                  </div>

                  {/* Committee 1 */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Committee 1</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered"
                      value={formData.committe1 || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          committe1: e.target.value
                            ? parseInt(e.target.value)
                            : undefined,
                        })
                      }
                    />
                  </div>

                  {/* Committee 2 */}
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Committee 2</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered"
                      value={formData.committe2 || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          committe2: e.target.value
                            ? parseInt(e.target.value)
                            : undefined,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="modal-action">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setShowAddModal(false);
                      setShowEditModal(false);
                      setSelectedCase(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {showEditModal ? "Update" : "Create"}
                  </button>
                </div>
              </form>
            </div>
            <form method="dialog" className="modal-backdrop">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                  setSelectedCase(null);
                }}
              >
                close
              </button>
            </form>
          </dialog>
        )}
      </main>
    </div>
  );
};

export default AdminCases;
