"use client";

import {
  createNotarial,
  deleteNotarial,
  getNotarial,
  updateNotarial,
} from "@/app/components/Case/Notarial/NotarialActions";
import { NotarialData } from "@/app/components/Case/Notarial/schema";
import { getGarageFileUrl } from "@/app/lib/garageActions";
import { useEffect, useMemo, useState } from "react";
import { deleteAllNotarial } from "./TestActions";
import NotarialExcelUploader from "../components/Case/Notarial/NotarialExcelUploader";

type NotarialFormState = {
  title: string;
  name: string;
  attorney: string;
  date: string;
  file: File | null;
  removeFile: boolean;
};

const EMPTY_FORM: NotarialFormState = {
  title: "",
  name: "",
  attorney: "",
  date: "",
  file: null,
  removeFile: false,
};

export default function NotarialTester() {
  const [items, setItems] = useState<NotarialData[]>([]);
  const [formData, setFormData] = useState<NotarialFormState>(EMPTY_FORM);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  useEffect(() => {
    void loadItems();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    const result = await getNotarial();
    if (result.success) {
      setItems(result.result);
      setMessage({ type: "success", text: "Notarial entries loaded." });
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to load notarial entries.",
      });
    }
    setLoading(false);
  };

  const handleChange = <K extends keyof NotarialFormState>(
    field: K,
    value: NotarialFormState[K],
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    const payload: Record<string, unknown> = {
      title: formData.title || null,
      name: formData.name || null,
      attorney: formData.attorney || null,
      date: formData.date ? new Date(formData.date) : null,
      path: undefined,
      removeFile: formData.removeFile || undefined,
      file: formData.file ?? undefined,
    };

    const result =
      isEditing && editingId
        ? await updateNotarial(editingId, payload)
        : await createNotarial({
            ...payload,
            removeFile: undefined,
          });
    if (result.success) {
      setMessage({
        type: "success",
        text: isEditing ? "Notarial entry updated." : "Notarial entry created.",
      });
      setFormData(EMPTY_FORM);
      setIsEditing(false);
      setEditingId(null);
      setFileInputKey((prev) => prev + 1);
      await loadItems();
    } else {
      setMessage({
        type: "error",
        text:
          result.error ||
          (isEditing
            ? "Failed to update notarial entry."
            : "Failed to create notarial entry."),
      });
    }

    setLoading(false);
  };

  const formattedCount = useMemo(() => String(items.length), [items.length]);

  const formatDate = (value?: Date | string | null) => {
    if (!value) return "-";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString();
  };

  const handleDownload = async (item: NotarialData) => {
    if (!item.file) {
      setMessage({ type: "error", text: "No file attached." });
      return;
    }

    const result = await getGarageFileUrl(item.file.key);
    if (result.success) {
      window.open(result.result, "_blank");
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to get file URL.",
      });
    }
  };

  const handleDelete = async (item: NotarialData) => {
    if (!confirm("Delete this notarial entry?")) return;
    setLoading(true);
    const result = await deleteNotarial(item.id);
    if (result.success) {
      setMessage({ type: "success", text: "Notarial entry deleted." });
      await loadItems();
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to delete notarial entry.",
      });
    }
    setLoading(false);
  };

  const handleDeleteAll = async () => {
    if (
      !confirm(
        "Are you sure you want to delete ALL notarial entries? This cannot be undone.",
      )
    ) {
      return;
    }

    setLoading(true);
    const result = await deleteAllNotarial();
    if (result.success) {
      setMessage({ type: "success", text: "All notarial entries deleted." });
      await loadItems();
    } else {
      setMessage({
        type: "error",
        text: result.error || "Failed to delete all notarial entries.",
      });
    }
    setLoading(false);
  };

  const handleEdit = (item: NotarialData) => {
    setFormData({
      title: item.title ?? "",
      name: item.name ?? "",
      attorney: item.attorney ?? "",
      date: item.date ? new Date(item.date).toISOString().split("T")[0] : "",
      file: null,
      removeFile: false,
    });
    setIsEditing(true);
    setEditingId(item.id);
    setFileInputKey((prev) => prev + 1);
  };

  const handleCancelEdit = () => {
    setFormData(EMPTY_FORM);
    setIsEditing(false);
    setEditingId(null);
    setFileInputKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Notarial Tester</h1>
            <p className="text-sm text-gray-600">
              Total entries: {formattedCount}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadItems}
              className="rounded bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              disabled={loading}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteAll()}
              className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              disabled={loading || items.length === 0}
            >
              Delete All
            </button>
          </div>
        </div>

        {message && (
          <div
            className={`rounded border px-4 py-3 text-sm ${
              message.type === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold">
                {isEditing ? "Update Notarial" : "Create Notarial"}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4 text-sm">
                <div>
                  <label className="mb-1 block font-medium">Title</label>
                  <input
                    value={formData.title}
                    onChange={(event) =>
                      handleChange("title", event.target.value)
                    }
                    className="w-full rounded border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium">Name</label>
                  <input
                    value={formData.name}
                    onChange={(event) =>
                      handleChange("name", event.target.value)
                    }
                    className="w-full rounded border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium">Attorney</label>
                  <input
                    value={formData.attorney}
                    onChange={(event) =>
                      handleChange("attorney", event.target.value)
                    }
                    className="w-full rounded border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium">Date Filed</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(event) =>
                      handleChange("date", event.target.value)
                    }
                    className="w-full rounded border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium">File</label>
                  <input
                    key={fileInputKey}
                    type="file"
                    onChange={(event) =>
                      handleChange("file", event.target.files?.[0] ?? null)
                    }
                    disabled={formData.removeFile}
                    className="w-full rounded border px-3 py-2"
                  />
                </div>
                {isEditing && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.removeFile}
                      onChange={(event) =>
                        handleChange("removeFile", event.target.checked)
                      }
                    />
                    Remove existing file
                  </label>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    disabled={loading}
                  >
                    {loading ? "Saving..." : isEditing ? "Update" : "Create"}
                  </button>
                  <button
                    type="button"
                    className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-100"
                    onClick={
                      isEditing
                        ? handleCancelEdit
                        : () => {
                            setFormData(EMPTY_FORM);
                            setFileInputKey((prev) => prev + 1);
                          }
                    }
                  >
                    {isEditing ? "Cancel" : "Clear"}
                  </button>
                </div>
              </form>
            </div>
            <NotarialExcelUploader onUploadCompleted={loadItems} />
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold">Existing Entries</h2>
              {items.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No notarial entries yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="px-3 py-2">ID</th>
                        <th className="px-3 py-2">Title</th>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Attorney</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">File</th>
                        <th className="px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="border-b">
                          <td className="px-3 py-2 font-medium">{item.id}</td>
                          <td className="px-3 py-2">{item.title ?? "-"}</td>
                          <td className="px-3 py-2">{item.name ?? "-"}</td>
                          <td className="px-3 py-2">{item.attorney ?? "-"}</td>
                          <td className="px-3 py-2">{formatDate(item.date)}</td>
                          <td className="px-3 py-2">
                            {item.file ? (
                              <button
                                type="button"
                                className="text-left text-blue-700 underline"
                                onClick={() => void handleDownload(item)}
                              >
                                {item.file.fileName}
                              </button>
                            ) : (
                              (item.fileId ?? "-")
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-700"
                                onClick={() => handleEdit(item)}
                              >
                                Update
                              </button>
                              <button
                                type="button"
                                className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                                onClick={() => void handleDelete(item)}
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
