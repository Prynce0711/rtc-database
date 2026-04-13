"use client";

import {
  createCivilCase,
  deleteCivilCase,
  getCivilCases,
  updateCivilCase,
} from "@/app/components/Case/Civil/CivilActions";
import {
  exportCasesExcel,
  uploadExcel,
} from "@/app/components/Case/Civil/ExcelActions";
import { CaseType } from "@/app/generated/prisma/client";
import {
  CivilCaseData,
  CivilCaseEntry,
  civilCaseToEntry,
  createEmptyCivilCaseEntry,
} from "@rtc-database/shared";
import { useEffect, useState } from "react";
import { deleteAllCases } from "./TestActions";

const CASE_TYPES: CaseType[] = ["CIVIL"];

export default function CivilCaseTester() {
  const [cases, setCases] = useState<CivilCaseData[]>([]);
  const [formData, setFormData] = useState<CivilCaseEntry>(
    createEmptyCivilCaseEntry(),
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [caseType, setCaseType] = useState<CaseType>("CIVIL");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    setLoading(true);
    const result = await getCivilCases();
    if (result.success) {
      setCases(result.result.items);
      setMessage({ type: "success", text: "Cases loaded successfully" });
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to load cases",
      });
    }
    setLoading(false);
  };

  const handleInputChange = <K extends keyof CivilCaseEntry>(
    field: K,
    value: CivilCaseEntry[K],
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        branch: formData.branch,
        assistantBranch: formData.assistantBranch,
        caseNumber: formData.caseNumber,
        dateFiled: formData.dateFiled,
        caseType: formData.caseType,
        petitioners: formData.petitioners,
        defendants: formData.defendants || null,
        notes: formData.notes || null,
        nature: formData.nature || null,
        originCaseNumber: formData.originCaseNumber || null,
        reRaffleDate: formData.reRaffleDate || null,
        reRaffleBranch: formData.reRaffleBranch || null,
        consolitationDate: formData.consolitationDate || null,
        consolidationBranch: formData.consolidationBranch || null,
        dateRemanded: formData.dateRemanded || null,
        remandedNote: formData.remandedNote || null,
      };

      let result;
      if (isEditing && editingId) {
        result = await updateCivilCase(editingId, data);
        if (result.success) {
          setMessage({ type: "success", text: "Case updated successfully" });
        }
      } else {
        result = await createCivilCase(data);
        if (result.success) {
          setMessage({ type: "success", text: "Case created successfully" });
        }
      }

      if (!result.success) {
        setMessage({ type: "error", text: result.error || "Operation failed" });
      } else {
        setFormData(createEmptyCivilCaseEntry());
        setIsEditing(false);
        setEditingId(null);
        await loadCases();
      }
    } catch {
      setMessage({ type: "error", text: "An error occurred" });
    }

    setLoading(false);
  };

  const handleEdit = (caseItem: CivilCaseData) => {
    const formEntry = civilCaseToEntry(caseItem);
    setFormData(formEntry);
    setIsEditing(true);
    setEditingId(caseItem.id);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this case?")) return;

    setLoading(true);
    const result = await deleteCivilCase(id);
    if (result.success) {
      setMessage({ type: "success", text: "Case deleted successfully" });
      await loadCases();
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to delete case",
      });
    }
    setLoading(false);
  };

  const handleCancel = () => {
    setFormData(createEmptyCivilCaseEntry());
    setIsEditing(false);
    setEditingId(null);
  };

  const handleExport = async () => {
    setLoading(true);
    const result = await exportCasesExcel();
    if (result.success) {
      const link = document.createElement("a");
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.result.base64}`;
      link.download = result.result.fileName;
      link.click();
      setMessage({
        type: "success",
        text: "Cases exported to Excel successfully",
      });
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to export cases",
      });
    }
    setLoading(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const result = await uploadExcel(file, caseType);
    if (result.success) {
      setMessage({
        type: "success",
        text: "Cases imported from Excel successfully",
      });
      await loadCases();
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to import cases",
      });
    }

    if (result.success && result.result?.failedExcel) {
      const { fileName, base64 } = result.result.failedExcel;
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

      setMessage({
        type: "success",
        text: "Import complete. Failed rows have been downloaded for review.",
      });
    }

    setLoading(false);
  };

  const handleDeleteAll = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete ALL cases? This cannot be undone.",
      )
    )
      return;
    setLoading(true);
    const result = await deleteAllCases(caseType);
    if (result.success) {
      setMessage({ type: "success", text: "All cases deleted successfully" });
      await loadCases();
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to delete all cases",
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Civil Case Tester</h1>

        {message && (
          <div
            className={`mb-4 p-4 rounded ${
              message.type === "success"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-8 max-h-screen overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">
                {isEditing ? "Edit Case" : "Add Case"}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-3 text-sm">
                <div>
                  <label className="block font-medium mb-1">Branch *</label>
                  <input
                    type="text"
                    value={(formData.branch ?? "") as string}
                    onChange={(e) =>
                      handleInputChange("branch", e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Assistant Branch *
                  </label>
                  <input
                    type="text"
                    value={formData.assistantBranch ?? ""}
                    onChange={(e) =>
                      handleInputChange("assistantBranch", e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Case Number *
                  </label>
                  <input
                    type="text"
                    value={formData.caseNumber}
                    onChange={(e) =>
                      handleInputChange("caseNumber", e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Date Filed</label>
                  <input
                    type="date"
                    value={
                      formData.dateFiled instanceof Date
                        ? formData.dateFiled.toISOString().split("T")[0]
                        : formData.dateFiled || ""
                    }
                    onChange={(e) =>
                      handleInputChange(
                        "dateFiled",
                        e.target.value ? new Date(e.target.value) : null,
                      )
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Petitioners *
                  </label>
                  <input
                    type="text"
                    value={formData.petitioners ?? ""}
                    onChange={(e) =>
                      handleInputChange("petitioners", e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                    required
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Defendants</label>
                  <input
                    type="text"
                    value={formData.defendants ?? ""}
                    onChange={(e) =>
                      handleInputChange("defendants", e.target.value || null)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Notes</label>
                  <input
                    type="text"
                    value={formData.notes ?? ""}
                    onChange={(e) =>
                      handleInputChange("notes", e.target.value || null)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Nature</label>
                  <input
                    type="text"
                    value={formData.nature ?? ""}
                    onChange={(e) =>
                      handleInputChange("nature", e.target.value || null)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Origin Case Number
                  </label>
                  <input
                    type="text"
                    value={formData.originCaseNumber ?? ""}
                    onChange={(e) =>
                      handleInputChange(
                        "originCaseNumber",
                        e.target.value || null,
                      )
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Re-Raffle Date
                  </label>
                  <input
                    type="date"
                    value={
                      formData.reRaffleDate instanceof Date
                        ? formData.reRaffleDate.toISOString().split("T")[0]
                        : formData.reRaffleDate || ""
                    }
                    onChange={(e) =>
                      handleInputChange(
                        "reRaffleDate",
                        e.target.value ? new Date(e.target.value) : null,
                      )
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Re-Raffle Branch
                  </label>
                  <input
                    type="text"
                    value={formData.reRaffleBranch ?? ""}
                    onChange={(e) =>
                      handleInputChange(
                        "reRaffleBranch",
                        e.target.value || null,
                      )
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Consolidation Date
                  </label>
                  <input
                    type="date"
                    value={
                      formData.consolitationDate instanceof Date
                        ? formData.consolitationDate.toISOString().split("T")[0]
                        : formData.consolitationDate || ""
                    }
                    onChange={(e) =>
                      handleInputChange(
                        "consolitationDate",
                        e.target.value ? new Date(e.target.value) : null,
                      )
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Consolidation Branch
                  </label>
                  <input
                    type="text"
                    value={formData.consolidationBranch ?? ""}
                    onChange={(e) =>
                      handleInputChange(
                        "consolidationBranch",
                        e.target.value || null,
                      )
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Date Remanded
                  </label>
                  <input
                    type="date"
                    value={
                      formData.dateRemanded instanceof Date
                        ? formData.dateRemanded.toISOString().split("T")[0]
                        : formData.dateRemanded || ""
                    }
                    onChange={(e) =>
                      handleInputChange(
                        "dateRemanded",
                        e.target.value ? new Date(e.target.value) : null,
                      )
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Remanded Note
                  </label>
                  <input
                    type="text"
                    value={formData.remandedNote ?? ""}
                    onChange={(e) =>
                      handleInputChange("remandedNote", e.target.value || null)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-50 text-sm font-medium"
                  >
                    {isEditing ? "Update" : "Add"}
                  </button>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="flex-1 bg-gray-500 text-white py-2 rounded hover:bg-gray-600 text-sm font-medium"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex gap-2 flex-wrap items-center">
                <button
                  onClick={loadCases}
                  disabled={loading}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
                >
                  Refresh
                </button>
                <button
                  onClick={handleExport}
                  disabled={loading}
                  className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50"
                >
                  Export Excel
                </button>
                <button
                  onClick={handleDeleteAll}
                  disabled={loading}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50"
                >
                  Delete All
                </button>
                <div className="flex items-center gap-2">
                  <select
                    value={caseType}
                    onChange={(e) => setCaseType(e.target.value as CaseType)}
                    className="border rounded px-3 py-2 text-sm"
                  >
                    {CASE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <label className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 cursor-pointer">
                    Import Excel
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleImport}
                      disabled={loading}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left">ID</th>
                      <th className="px-4 py-2 text-left">Case No</th>
                      <th className="px-4 py-2 text-left">Petitioners</th>
                      <th className="px-4 py-2 text-left">Defendants</th>
                      <th className="px-4 py-2 text-left">Branch</th>
                      <th className="px-4 py-2 text-left">Nature</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-4 text-center text-gray-500"
                        >
                          No cases found
                        </td>
                      </tr>
                    ) : (
                      cases.map((caseItem) => (
                        <tr
                          key={caseItem.id}
                          className="border-t hover:bg-gray-50"
                        >
                          <td className="px-4 py-2">{caseItem.id}</td>
                          <td className="px-4 py-2">{caseItem.caseNumber}</td>
                          <td className="px-4 py-2">{caseItem.petitioners}</td>
                          <td className="px-4 py-2">
                            {caseItem.defendants || "-"}
                          </td>
                          <td className="px-4 py-2">{caseItem.branch}</td>
                          <td className="px-4 py-2 truncate max-w-xs">
                            {caseItem.nature}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEdit(caseItem)}
                                className="bg-yellow-500 text-white px-3 py-1 rounded text-xs hover:bg-yellow-600"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(caseItem.id)}
                                className="bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
