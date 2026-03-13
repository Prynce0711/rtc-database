"use client";

import {
  createCriminalCase,
  deleteCriminalCase,
  getCriminalCases,
  updateCriminalCase,
} from "@/app/components/Case/Criminal/CriminalCasesActions";
import {
  exportCasesExcel,
  uploadExcel,
} from "@/app/components/Case/Criminal/ExcelActions";
import {
  CaseEntry,
  CriminalCaseData,
  caseToEntry,
  createEmptyEntry,
} from "@/app/components/Case/Criminal/schema";
import { CaseType } from "@/app/generated/prisma/client";
import { useEffect, useState } from "react";
import { deleteAllCases } from "./TestActions";

const CASE_TYPES: CaseType[] = ["CRIMINAL"];

export default function CriminalCaseTester() {
  const [cases, setCases] = useState<CriminalCaseData[]>([]);
  const [formData, setFormData] = useState<CaseEntry>(createEmptyEntry());
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [caseType, setCaseType] = useState<CaseType>("CRIMINAL");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    setLoading(true);
    const result = await getCriminalCases();
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

  const handleInputChange = <K extends keyof CaseEntry>(
    field: K,
    value: CaseEntry[K],
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
        name: formData.name,
        charge: formData.charge,
        infoSheet: formData.infoSheet,
        court: formData.court,
        caseType: formData.caseType,
        detained: formData.detained,
        consolidation: formData.consolidation,
        eqcNumber: formData.eqcNumber || null,
        bond: formData.bond || null,
        raffleDate: formData.raffleDate || null,
        committee1: formData.committee1 || null,
        committee2: formData.committee2 || null,
        judge: formData.judge || null,
        ao: formData.ao || null,
        complainant: formData.complainant || null,
        houseNo: formData.houseNo || null,
        street: formData.street || null,
        barangay: formData.barangay || null,
        municipality: formData.municipality || null,
        province: formData.province || null,
        counts: formData.counts || null,
        jdf: formData.jdf || null,
        sajj: formData.sajj || null,
        sajj2: formData.sajj2 || null,
        mf: formData.mf || null,
        stf: formData.stf || null,
        lrf: formData.lrf || null,
        vcf: formData.vcf || null,
        total: formData.total || null,
        amountInvolved: formData.amountInvolved || null,
      };

      let result;
      if (isEditing && editingId) {
        result = await updateCriminalCase(editingId, data);
        if (result.success) {
          setMessage({ type: "success", text: "Case updated successfully" });
        }
      } else {
        result = await createCriminalCase(data);
        if (result.success) {
          setMessage({ type: "success", text: "Case created successfully" });
        }
      }

      if (!result.success) {
        setMessage({ type: "error", text: result.error || "Operation failed" });
      } else {
        setFormData(createEmptyEntry());
        setIsEditing(false);
        setEditingId(null);
        await loadCases();
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred" });
    }

    setLoading(false);
  };

  const handleEdit = (caseItem: CriminalCaseData) => {
    const formEntry = caseToEntry(caseItem);
    setFormData(formEntry);
    setIsEditing(true);
    setEditingId(caseItem.id);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this case?")) return;

    setLoading(true);
    const result = await deleteCriminalCase(id);
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
    setFormData(createEmptyEntry());
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
    const result = await uploadExcel(file);
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

    // Download failed rows Excel if available
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
    const result = await deleteAllCases();
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
        <h1 className="text-3xl font-bold mb-8">Case Tester</h1>

        {/* Messages */}
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
          {/* Form */}
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
                  <label className="block font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name ?? ""}
                    onChange={(e) =>
                      handleInputChange(
                        "name",
                        e.target.value as CaseEntry["name"],
                      )
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Charge</label>
                  <input
                    type="text"
                    value={formData.charge ?? ""}
                    onChange={(e) =>
                      handleInputChange("charge", e.target.value || null)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Info Sheet</label>
                  <input
                    type="text"
                    value={formData.infoSheet ?? ""}
                    onChange={(e) =>
                      handleInputChange("infoSheet", e.target.value || null)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Court</label>
                  <input
                    type="text"
                    value={formData.court ?? ""}
                    onChange={(e) =>
                      handleInputChange("court", e.target.value || null)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Case Type *</label>
                  <select
                    value={formData.caseType}
                    onChange={(e) =>
                      handleInputChange<"caseType">(
                        "caseType",
                        e.target.value as CaseType,
                      )
                    }
                    className="w-full border rounded px-2 py-1"
                  >
                    {CASE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Detained</label>
                  <input
                    type="text"
                    value={formData.detained ?? ""}
                    onChange={(e) =>
                      handleInputChange("detained", e.target.value || null)
                    }
                    className="w-full border rounded px-2 py-1"
                    placeholder="e.g., Yes, No, or leave blank"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Consolidation
                  </label>
                  <input
                    type="text"
                    value={formData.consolidation ?? ""}
                    onChange={(e) =>
                      handleInputChange("consolidation", e.target.value || null)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <hr className="my-2" />

                <div>
                  <label className="block font-medium mb-1">EQC Number</label>
                  <input
                    type="number"
                    value={formData.eqcNumber ?? ""}
                    onChange={(e) =>
                      handleInputChange(
                        "eqcNumber",
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Bond</label>
                  <input
                    type="text"
                    value={formData.bond ?? ""}
                    onChange={(e) =>
                      handleInputChange("bond", e.target.value || null)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Raffle Date</label>
                  <input
                    type="date"
                    value={
                      formData.raffleDate instanceof Date
                        ? formData.raffleDate.toISOString().split("T")[0]
                        : formData.raffleDate || ""
                    }
                    onChange={(e) =>
                      handleInputChange(
                        "raffleDate",
                        e.target.value ? new Date(e.target.value) : null,
                      )
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Committee 1</label>
                  <input
                    type="text"
                    value={formData.committee1 ?? ""}
                    onChange={(e) =>
                      handleInputChange("committee1", e.target.value || null)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Committee 2</label>
                  <input
                    type="text"
                    value={formData.committee2 ?? ""}
                    onChange={(e) =>
                      handleInputChange("committee2", e.target.value || null)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Judge</label>
                  <input
                    type="text"
                    value={formData.judge ?? ""}
                    onChange={(e) => handleInputChange("judge", e.target.value)}
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">AO</label>
                  <input
                    type="text"
                    value={formData.ao ?? ""}
                    onChange={(e) => handleInputChange("ao", e.target.value)}
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Complainant</label>
                  <input
                    type="text"
                    value={formData.complainant ?? ""}
                    onChange={(e) =>
                      handleInputChange("complainant", e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">House No</label>
                  <input
                    type="text"
                    value={formData.houseNo ?? ""}
                    onChange={(e) =>
                      handleInputChange("houseNo", e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Street</label>
                  <input
                    type="text"
                    value={formData.street ?? ""}
                    onChange={(e) =>
                      handleInputChange("street", e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Barangay</label>
                  <input
                    type="text"
                    value={formData.barangay ?? ""}
                    onChange={(e) =>
                      handleInputChange("barangay", e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Municipality</label>
                  <input
                    type="text"
                    value={formData.municipality ?? ""}
                    onChange={(e) =>
                      handleInputChange("municipality", e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Province</label>
                  <input
                    type="text"
                    value={formData.province ?? ""}
                    onChange={(e) =>
                      handleInputChange("province", e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Counts</label>
                  <input
                    type="text"
                    value={formData.counts ?? ""}
                    onChange={(e) =>
                      handleInputChange("counts", e.target.value)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">JDF</label>
                  <input
                    type="text"
                    value={formData.jdf ?? ""}
                    onChange={(e) =>
                      handleInputChange("jdf", e.target.value || null)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">SAJJ</label>
                  <input
                    type="text"
                    value={formData.sajj ?? ""}
                    onChange={(e) =>
                      handleInputChange("sajj", e.target.value || null)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">SAJJ 2</label>
                  <input
                    type="text"
                    value={formData.sajj2 ?? ""}
                    onChange={(e) =>
                      handleInputChange("sajj2", e.target.value || null)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">MF</label>
                  <input
                    type="text"
                    value={formData.mf ?? ""}
                    onChange={(e) =>
                      handleInputChange("mf", e.target.value || null)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">STF</label>
                  <input
                    type="text"
                    value={formData.stf ?? ""}
                    onChange={(e) =>
                      handleInputChange("stf", e.target.value || null)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">LRF</label>
                  <input
                    type="text"
                    value={formData.lrf ?? ""}
                    onChange={(e) =>
                      handleInputChange("lrf", e.target.value || null)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">VCF</label>
                  <input
                    type="text"
                    value={formData.vcf ?? ""}
                    onChange={(e) =>
                      handleInputChange("vcf", e.target.value || null)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Total</label>
                  <input
                    type="text"
                    value={formData.total ?? ""}
                    onChange={(e) =>
                      handleInputChange("total", e.target.value || null)
                    }
                    className="w-full border rounded px-2 py-1"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Amount Involved
                  </label>
                  <input
                    type="text"
                    value={formData.amountInvolved ?? ""}
                    onChange={(e) =>
                      handleInputChange(
                        "amountInvolved",
                        e.target.value || null,
                      )
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

          {/* Data and Controls */}
          <div className="lg:col-span-3">
            {/* Controls */}
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

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left">ID</th>
                      <th className="px-4 py-2 text-left">Case No</th>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Branch</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-left">Charge</th>
                      <th className="px-4 py-2 text-left">Detained</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
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
                          <td className="px-4 py-2">{caseItem.name}</td>
                          <td className="px-4 py-2">{caseItem.branch}</td>
                          <td className="px-4 py-2">{caseItem.caseType}</td>
                          <td className="px-4 py-2 truncate max-w-xs">
                            {caseItem.charge}
                          </td>
                          <td className="px-4 py-2">
                            {caseItem.detained ? "Yes" : "No"}
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
