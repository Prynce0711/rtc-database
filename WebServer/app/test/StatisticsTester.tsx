"use client";

import {
    createAnnualTrialCourt,
    createInventoryDocument,
    deleteAnnualTrialCourt,
    deleteInventoryDocument,
    getAnnualTrialCourts,
    getInventoryDocuments,
    updateAnnualTrialCourt,
    updateInventoryDocument,
} from "@/app/components/Statistics/Annual/AnnualActions";
import {
    CaseSchema,
    InventoryDocumentSchema,
} from "@/app/components/Statistics/Annual/Schema";
import { useEffect, useState } from "react";

type Tab = "annual" | "inventory";

export default function StatisticsTester() {
  const [activeTab, setActiveTab] = useState<Tab>("annual");

  // ── Annual Trial Courts ──────────────────────────────────────────────────
  const [annualRecords, setAnnualRecords] = useState<CaseSchema[]>([]);
  const [annualForm, setAnnualForm] = useState<CaseSchema>({
    branch: "",
    pendingLastYear: "",
    RaffledOrAdded: "",
    Disposed: "",
    pendingThisYear: "",
    percentageOfDisposition: "",
  });
  const [isEditingAnnual, setIsEditingAnnual] = useState(false);
  const [editingAnnualId, setEditingAnnualId] = useState<number | null>(null);

  // ── Inventory Documents ──────────────────────────────────────────────────
  const [inventoryRecords, setInventoryRecords] = useState<
    InventoryDocumentSchema[]
  >([]);
  const [inventoryForm, setInventoryForm] = useState<InventoryDocumentSchema>({
    region: "",
    province: "",
    court: "",
    cityMunicipality: "",
    branch: "",
    civilSmallClaimsFiled: "",
    criminalCasesFiled: "",
    civilSmallClaimsDisposed: "",
    criminalCasesDisposed: "",
    dateRecorded: "",
  });
  const [isEditingInventory, setIsEditingInventory] = useState(false);
  const [editingInventoryId, setEditingInventoryId] = useState<number | null>(
    null,
  );

  // ── Shared ───────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // ── Loaders ──────────────────────────────────────────────────────────────
  async function loadAnnualRecords() {
    setLoading(true);
    const result = await getAnnualTrialCourts();
    if (result.success) {
      setAnnualRecords(result.result);
      setMessage({
        type: "success",
        text: "Annual records loaded successfully",
      });
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to load annual records",
      });
    }
    setLoading(false);
  }

  async function loadInventoryRecords() {
    setLoading(true);
    const result = await getInventoryDocuments();
    if (result.success) {
      setInventoryRecords(result.result);
      setMessage({
        type: "success",
        text: "Inventory documents loaded successfully",
      });
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to load inventory documents",
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    loadAnnualRecords();
    loadInventoryRecords();
  }, []);

  // ── Annual handlers ──────────────────────────────────────────────────────
  const handleAnnualInputChange = (field: keyof CaseSchema, value: string) => {
    setAnnualForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAnnualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let result;
      if (isEditingAnnual && editingAnnualId) {
        result = await updateAnnualTrialCourt(editingAnnualId, annualForm);
        if (result.success) {
          setMessage({
            type: "success",
            text: "Annual record updated successfully",
          });
        }
      } else {
        result = await createAnnualTrialCourt(annualForm);
        if (result.success) {
          setMessage({
            type: "success",
            text: "Annual record created successfully",
          });
        }
      }

      if (!result.success) {
        setMessage({ type: "error", text: result.error || "Operation failed" });
      } else {
        setAnnualForm({
          branch: "",
          pendingLastYear: "",
          RaffledOrAdded: "",
          Disposed: "",
          pendingThisYear: "",
          percentageOfDisposition: "",
        });
        setIsEditingAnnual(false);
        setEditingAnnualId(null);
        await loadAnnualRecords();
      }
    } catch {
      setMessage({ type: "error", text: "An error occurred" });
    }

    setLoading(false);
  };

  const handleAnnualEdit = (record: CaseSchema) => {
    setAnnualForm({
      branch: record.branch,
      pendingLastYear: record.pendingLastYear ?? "",
      RaffledOrAdded: record.RaffledOrAdded ?? "",
      Disposed: record.Disposed ?? "",
      pendingThisYear: record.pendingThisYear ?? "",
      percentageOfDisposition: record.percentageOfDisposition ?? "",
    });
    setIsEditingAnnual(true);
    setEditingAnnualId(record.id ?? null);
  };

  const handleAnnualDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    setLoading(true);
    const result = await deleteAnnualTrialCourt(id);
    if (result.success) {
      setMessage({ type: "success", text: "Record deleted successfully" });
      await loadAnnualRecords();
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to delete record",
      });
    }
    setLoading(false);
  };

  const handleAnnualCancel = () => {
    setAnnualForm({
      branch: "",
      pendingLastYear: "",
      RaffledOrAdded: "",
      Disposed: "",
      pendingThisYear: "",
      percentageOfDisposition: "",
    });
    setIsEditingAnnual(false);
    setEditingAnnualId(null);
  };

  // ── Inventory handlers ───────────────────────────────────────────────────
  const handleInventoryInputChange = (
    field: keyof InventoryDocumentSchema,
    value: string,
  ) => {
    setInventoryForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleInventorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data: InventoryDocumentSchema = {
        ...inventoryForm,
        dateRecorded: inventoryForm.dateRecorded
          ? new Date(inventoryForm.dateRecorded as string)
          : undefined,
      };

      let result;
      if (isEditingInventory && editingInventoryId) {
        result = await updateInventoryDocument(editingInventoryId, data);
        if (result.success) {
          setMessage({
            type: "success",
            text: "Inventory document updated successfully",
          });
        }
      } else {
        result = await createInventoryDocument(data);
        if (result.success) {
          setMessage({
            type: "success",
            text: "Inventory document created successfully",
          });
        }
      }

      if (!result.success) {
        setMessage({ type: "error", text: result.error || "Operation failed" });
      } else {
        setInventoryForm({
          region: "",
          province: "",
          court: "",
          cityMunicipality: "",
          branch: "",
          civilSmallClaimsFiled: "",
          criminalCasesFiled: "",
          civilSmallClaimsDisposed: "",
          criminalCasesDisposed: "",
          dateRecorded: "",
        });
        setIsEditingInventory(false);
        setEditingInventoryId(null);
        await loadInventoryRecords();
      }
    } catch {
      setMessage({ type: "error", text: "An error occurred" });
    }

    setLoading(false);
  };

  const handleInventoryEdit = (record: InventoryDocumentSchema) => {
    setInventoryForm({
      region: record.region,
      province: record.province,
      court: record.court,
      cityMunicipality: record.cityMunicipality,
      branch: record.branch,
      civilSmallClaimsFiled: record.civilSmallClaimsFiled ?? "",
      criminalCasesFiled: record.criminalCasesFiled ?? "",
      civilSmallClaimsDisposed: record.civilSmallClaimsDisposed ?? "",
      criminalCasesDisposed: record.criminalCasesDisposed ?? "",
      dateRecorded: record.dateRecorded
        ? new Date(record.dateRecorded as string).toISOString().split("T")[0]
        : "",
    });
    setIsEditingInventory(true);
    setEditingInventoryId(record.id ?? null);
  };

  const handleInventoryDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    setLoading(true);
    const result = await deleteInventoryDocument(id);
    if (result.success) {
      setMessage({ type: "success", text: "Record deleted successfully" });
      await loadInventoryRecords();
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to delete record",
      });
    }
    setLoading(false);
  };

  const handleInventoryCancel = () => {
    setInventoryForm({
      region: "",
      province: "",
      court: "",
      cityMunicipality: "",
      branch: "",
      civilSmallClaimsFiled: "",
      criminalCasesFiled: "",
      civilSmallClaimsDisposed: "",
      criminalCasesDisposed: "",
      dateRecorded: "",
    });
    setIsEditingInventory(false);
    setEditingInventoryId(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Statistics Tester</h1>

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

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("annual")}
            className={`px-4 py-2 rounded font-medium ${
              activeTab === "annual"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border hover:bg-gray-50"
            }`}
          >
            Annual Trial Courts
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            className={`px-4 py-2 rounded font-medium ${
              activeTab === "inventory"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border hover:bg-gray-50"
            }`}
          >
            Inventory Documents
          </button>
        </div>

        {/* ── Annual Trial Courts ── */}
        {activeTab === "annual" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">
                  {isEditingAnnual ? "Edit Record" : "Add Record"}
                </h2>
                <form onSubmit={handleAnnualSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Branch *
                    </label>
                    <input
                      type="text"
                      value={annualForm.branch}
                      onChange={(e) =>
                        handleAnnualInputChange("branch", e.target.value)
                      }
                      className="w-full border rounded px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Pending Last Year
                    </label>
                    <input
                      type="text"
                      value={annualForm.pendingLastYear as string}
                      onChange={(e) =>
                        handleAnnualInputChange(
                          "pendingLastYear",
                          e.target.value,
                        )
                      }
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Raffled / Added
                    </label>
                    <input
                      type="text"
                      value={annualForm.RaffledOrAdded as string}
                      onChange={(e) =>
                        handleAnnualInputChange(
                          "RaffledOrAdded",
                          e.target.value,
                        )
                      }
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Disposed
                    </label>
                    <input
                      type="text"
                      value={annualForm.Disposed as string}
                      onChange={(e) =>
                        handleAnnualInputChange("Disposed", e.target.value)
                      }
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Pending This Year
                    </label>
                    <input
                      type="text"
                      value={annualForm.pendingThisYear as string}
                      onChange={(e) =>
                        handleAnnualInputChange(
                          "pendingThisYear",
                          e.target.value,
                        )
                      }
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      % of Disposition
                    </label>
                    <input
                      type="text"
                      value={annualForm.percentageOfDisposition as string}
                      onChange={(e) =>
                        handleAnnualInputChange(
                          "percentageOfDisposition",
                          e.target.value,
                        )
                      }
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                      {isEditingAnnual ? "Update" : "Add"}
                    </button>
                    {isEditingAnnual && (
                      <button
                        type="button"
                        onClick={handleAnnualCancel}
                        className="flex-1 bg-gray-500 text-white py-2 rounded hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            {/* Data and Controls */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={loadAnnualRecords}
                    disabled={loading}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left">Branch</th>
                      <th className="px-4 py-2 text-left">Pending Last Yr</th>
                      <th className="px-4 py-2 text-left">Raffled/Added</th>
                      <th className="px-4 py-2 text-left">Disposed</th>
                      <th className="px-4 py-2 text-left">Pending This Yr</th>
                      <th className="px-4 py-2 text-left">% Disposition</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {annualRecords.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-4 text-center text-gray-500"
                        >
                          No annual records found
                        </td>
                      </tr>
                    ) : (
                      annualRecords.map((record) => (
                        <tr
                          key={record.id}
                          className="border-t hover:bg-gray-50"
                        >
                          <td className="px-4 py-2">{record.branch}</td>
                          <td className="px-4 py-2">
                            {String(record.pendingLastYear ?? "-")}
                          </td>
                          <td className="px-4 py-2">
                            {String(record.RaffledOrAdded ?? "-")}
                          </td>
                          <td className="px-4 py-2">
                            {String(record.Disposed ?? "-")}
                          </td>
                          <td className="px-4 py-2">
                            {String(record.pendingThisYear ?? "-")}
                          </td>
                          <td className="px-4 py-2">
                            {String(record.percentageOfDisposition ?? "-")}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAnnualEdit(record)}
                                className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() =>
                                  record.id && handleAnnualDelete(record.id)
                                }
                                className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
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
        )}

        {/* ── Inventory Documents ── */}
        {activeTab === "inventory" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4">
                  {isEditingInventory ? "Edit Document" : "Add Document"}
                </h2>
                <form onSubmit={handleInventorySubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Region *
                    </label>
                    <input
                      type="text"
                      value={inventoryForm.region}
                      onChange={(e) =>
                        handleInventoryInputChange("region", e.target.value)
                      }
                      className="w-full border rounded px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Province *
                    </label>
                    <input
                      type="text"
                      value={inventoryForm.province}
                      onChange={(e) =>
                        handleInventoryInputChange("province", e.target.value)
                      }
                      className="w-full border rounded px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Court *
                    </label>
                    <input
                      type="text"
                      value={inventoryForm.court}
                      onChange={(e) =>
                        handleInventoryInputChange("court", e.target.value)
                      }
                      className="w-full border rounded px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      City / Municipality *
                    </label>
                    <input
                      type="text"
                      value={inventoryForm.cityMunicipality}
                      onChange={(e) =>
                        handleInventoryInputChange(
                          "cityMunicipality",
                          e.target.value,
                        )
                      }
                      className="w-full border rounded px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Branch *
                    </label>
                    <input
                      type="text"
                      value={inventoryForm.branch}
                      onChange={(e) =>
                        handleInventoryInputChange("branch", e.target.value)
                      }
                      className="w-full border rounded px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Civil Small Claims Filed
                    </label>
                    <input
                      type="text"
                      value={inventoryForm.civilSmallClaimsFiled as string}
                      onChange={(e) =>
                        handleInventoryInputChange(
                          "civilSmallClaimsFiled",
                          e.target.value,
                        )
                      }
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Criminal Cases Filed
                    </label>
                    <input
                      type="text"
                      value={inventoryForm.criminalCasesFiled as string}
                      onChange={(e) =>
                        handleInventoryInputChange(
                          "criminalCasesFiled",
                          e.target.value,
                        )
                      }
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Civil Small Claims Disposed
                    </label>
                    <input
                      type="text"
                      value={inventoryForm.civilSmallClaimsDisposed as string}
                      onChange={(e) =>
                        handleInventoryInputChange(
                          "civilSmallClaimsDisposed",
                          e.target.value,
                        )
                      }
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Criminal Cases Disposed
                    </label>
                    <input
                      type="text"
                      value={inventoryForm.criminalCasesDisposed as string}
                      onChange={(e) =>
                        handleInventoryInputChange(
                          "criminalCasesDisposed",
                          e.target.value,
                        )
                      }
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Date Recorded
                    </label>
                    <input
                      type="date"
                      value={inventoryForm.dateRecorded as string}
                      onChange={(e) =>
                        handleInventoryInputChange(
                          "dateRecorded",
                          e.target.value,
                        )
                      }
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                      {isEditingInventory ? "Update" : "Add"}
                    </button>
                    {isEditingInventory && (
                      <button
                        type="button"
                        onClick={handleInventoryCancel}
                        className="flex-1 bg-gray-500 text-white py-2 rounded hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            {/* Data and Controls */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={loadInventoryRecords}
                    disabled={loading}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left">Region</th>
                      <th className="px-4 py-2 text-left">Province</th>
                      <th className="px-4 py-2 text-left">Court</th>
                      <th className="px-4 py-2 text-left">City/Municipality</th>
                      <th className="px-4 py-2 text-left">Branch</th>
                      <th className="px-4 py-2 text-left">Date Recorded</th>
                      <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryRecords.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-4 text-center text-gray-500"
                        >
                          No inventory documents found
                        </td>
                      </tr>
                    ) : (
                      inventoryRecords.map((record) => (
                        <tr
                          key={record.id}
                          className="border-t hover:bg-gray-50"
                        >
                          <td className="px-4 py-2">{record.region}</td>
                          <td className="px-4 py-2">{record.province}</td>
                          <td className="px-4 py-2">{record.court}</td>
                          <td className="px-4 py-2">
                            {record.cityMunicipality}
                          </td>
                          <td className="px-4 py-2">{record.branch}</td>
                          <td className="px-4 py-2">
                            {record.dateRecorded
                              ? new Date(
                                  record.dateRecorded as string,
                                ).toLocaleDateString()
                              : "-"}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleInventoryEdit(record)}
                                className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() =>
                                  record.id && handleInventoryDelete(record.id)
                                }
                                className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
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
        )}
      </div>
    </div>
  );
}
