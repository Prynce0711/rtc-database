"use client";

import {
  exportSpecialProceedingsExcel,
  uploadSpecialProceedingExcel,
} from "@/app/components/Case/SpecialProceedings/ExcelActions";
import {
  SpecialProceedingFormEntry,
  createEmptySpecialProceedingFormEntry,
  specialProceedingToFormEntry,
} from "@/app/components/Case/SpecialProceedings/schema";
import {
  createSpecialProceeding,
  deleteSpecialProceeding,
  getSpecialProceedings,
  updateSpecialProceeding,
} from "@/app/components/Case/SpecialProceedings/SpecialProceedingsActions";
import { SpecialProceeding } from "@/app/generated/prisma/client";
import { useEffect, useState } from "react";

export default function SpecialProceedingTester() {
  const [specialProceedings, setSpecialProceedings] = useState<
    SpecialProceeding[]
  >([]);
  const [formData, setFormData] = useState<SpecialProceedingFormEntry>(
    createEmptySpecialProceedingFormEntry("new"),
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Fetch special proceedings on mount
  useEffect(() => {
    loadSpecialProceedings();
  }, []);

  const loadSpecialProceedings = async () => {
    setLoading(true);
    const result = await getSpecialProceedings();
    if (result.success) {
      setSpecialProceedings(result.result);
      setMessage({
        type: "success",
        text: "Special proceedings loaded successfully",
      });
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to load special proceedings",
      });
    }
    setLoading(false);
  };

  const handleInputChange = (
    field: keyof SpecialProceedingFormEntry,
    value: any,
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
        caseNumber: formData.caseNumber,
        petitioner: formData.petitioner || null,
        raffledTo: formData.raffledTo || null,
        date: formData.date ? new Date(formData.date) : null,
        nature: formData.nature || null,
        respondent: formData.respondent || null,
      };

      let result;
      if (isEditing && editingId) {
        result = await updateSpecialProceeding(editingId, data);
        if (result.success) {
          setMessage({
            type: "success",
            text: "Special proceeding updated successfully",
          });
        }
      } else {
        result = await createSpecialProceeding(data);
        if (result.success) {
          setMessage({
            type: "success",
            text: "Special proceeding created successfully",
          });
        }
      }

      if (!result.success) {
        setMessage({ type: "error", text: result.error || "Operation failed" });
      } else {
        setFormData(createEmptySpecialProceedingFormEntry("new"));
        setIsEditing(false);
        setEditingId(null);
        await loadSpecialProceedings();
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred" });
    }

    setLoading(false);
  };

  const handleEdit = (specialProceeding: SpecialProceeding) => {
    const formEntry = specialProceedingToFormEntry(
      specialProceeding.id.toString(),
      {
        caseNumber: specialProceeding.caseNumber,
        petitioner: specialProceeding.petitioner,
        raffledTo: specialProceeding.raffledTo,
        date: specialProceeding.date,
        nature: specialProceeding.nature,
        respondent: specialProceeding.respondent,
      },
    );
    setFormData(formEntry);
    setIsEditing(true);
    setEditingId(specialProceeding.id);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this special proceeding?"))
      return;

    setLoading(true);
    const result = await deleteSpecialProceeding(id);
    if (result.success) {
      setMessage({
        type: "success",
        text: "Special proceeding deleted successfully",
      });
      await loadSpecialProceedings();
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to delete special proceeding",
      });
    }
    setLoading(false);
  };

  const handleCancel = () => {
    setFormData(createEmptySpecialProceedingFormEntry("new"));
    setIsEditing(false);
    setEditingId(null);
  };

  const handleExport = async () => {
    setLoading(true);
    const result = await exportSpecialProceedingsExcel();
    if (result.success) {
      const link = document.createElement("a");
      link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.result.base64}`;
      link.download = result.result.fileName;
      link.click();
      setMessage({
        type: "success",
        text: "Special proceedings exported to Excel successfully",
      });
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to export special proceedings",
      });
    }
    setLoading(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const result = await uploadSpecialProceedingExcel(file);
    if (result.success) {
      setMessage({
        type: "success",
        text: "Special proceedings imported from Excel successfully",
      });
      await loadSpecialProceedings();
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to import special proceedings",
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Special Proceeding Tester</h1>

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">
                {isEditing
                  ? "Edit Special Proceeding"
                  : "Add Special Proceeding"}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Case Number *
                  </label>
                  <input
                    type="text"
                    value={formData.caseNumber}
                    onChange={(e) =>
                      handleInputChange("caseNumber", e.target.value)
                    }
                    className="w-full border rounded px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Petitioner
                  </label>
                  <input
                    type="text"
                    value={formData.petitioner}
                    onChange={(e) =>
                      handleInputChange("petitioner", e.target.value)
                    }
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Respondent
                  </label>
                  <input
                    type="text"
                    value={formData.respondent}
                    onChange={(e) =>
                      handleInputChange("respondent", e.target.value)
                    }
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Raffled To
                  </label>
                  <input
                    type="text"
                    value={formData.raffledTo}
                    onChange={(e) =>
                      handleInputChange("raffledTo", e.target.value)
                    }
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange("date", e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Nature
                  </label>
                  <textarea
                    value={formData.nature}
                    onChange={(e) =>
                      handleInputChange("nature", e.target.value)
                    }
                    className="w-full border rounded px-3 py-2"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                  >
                    {isEditing ? "Update" : "Add"}
                  </button>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={handleCancel}
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
            {/* Controls */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={loadSpecialProceedings}
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

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left">Case Number</th>
                    <th className="px-4 py-2 text-left">Petitioner</th>
                    <th className="px-4 py-2 text-left">Respondent</th>
                    <th className="px-4 py-2 text-left">Raffled To</th>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {specialProceedings.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-4 text-center text-gray-500"
                      >
                        No special proceedings found
                      </td>
                    </tr>
                  ) : (
                    specialProceedings.map((sp) => (
                      <tr key={sp.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-2">{sp.caseNumber}</td>
                        <td className="px-4 py-2">{sp.petitioner || "-"}</td>
                        <td className="px-4 py-2">{sp.respondent || "-"}</td>
                        <td className="px-4 py-2">{sp.raffledTo || "-"}</td>
                        <td className="px-4 py-2">
                          {sp.date
                            ? new Date(sp.date).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(sp)}
                              className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(sp.id)}
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
      </div>
    </div>
  );
}
