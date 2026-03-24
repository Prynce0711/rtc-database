"use client";

import type { NotarialFormEntry } from "@/app/components/Case/Notarial/Notarial";
import {
  getNotarialById,
  getNotarialByIds,
  updateNotarial,
} from "@/app/components/Case/Notarial/NotarialActions";
import NotarialEdit from "@/app/components/Case/Notarial/NotarialEdit";
import type { NotarialRecord } from "@/app/components/Case/Notarial/NotarialRow";
import type { NotarialData } from "@/app/components/Case/Notarial/schema";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const toRecord = (item: NotarialData): NotarialRecord => ({
  id: item.id,
  title: item.title ?? "",
  name: item.name ?? "",
  atty: item.attorney ?? "",
  date: item.date ? new Date(item.date).toISOString().slice(0, 10) : "",
  link: item.file?.key ?? "",
  fileName: item.file?.fileName ?? undefined,
  mimeType: item.file?.mimeType ?? undefined,
});

const NotarialEditPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedRecord, setSelectedRecord] = useState<NotarialRecord | null>(
    null,
  );
  const [selectedRecords, setSelectedRecords] = useState<NotarialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const idParam = searchParams.get("id");
    const idsParam = searchParams.get("ids");

    const ids = idsParam
      ? Array.from(
          new Set(
            idsParam
              .split(",")
              .map((value) => Number(value.trim()))
              .filter((value) => Number.isInteger(value) && value > 0),
          ),
        )
      : [];

    if (ids.length === 0 && !idParam) {
      setError("Missing case id");
      setLoading(false);
      return;
    }

    const loadRecord = async () => {
      setLoading(true);

      if (ids.length > 0) {
        const result = await getNotarialByIds(ids);
        if (!result.success || !result.result) {
          const message =
            !result.success && "error" in result
              ? result.error || "Failed to load record"
              : "Failed to load record";
          setError(message);
          setLoading(false);
          return;
        }

        const loadedRecords = result.result.map(toRecord);

        setSelectedRecords(loadedRecords);
        setSelectedRecord(loadedRecords[0] ?? null);
        setError(null);
        setLoading(false);
        return;
      }

      const parsedId = Number(idParam);
      const result = await getNotarialById(parsedId);

      if (!result.success || !result.result) {
        const message =
          !result.success && "error" in result
            ? result.error || "Failed to load record"
            : "Failed to load record";
        setError(message);
        setLoading(false);
        return;
      }

      const loaded = toRecord(result.result);
      setSelectedRecord(loaded);
      setSelectedRecords([loaded]);
      setError(null);
      setLoading(false);
    };

    void loadRecord();
  }, [searchParams]);

  const goBack = () => router.push("/user/cases/notarial");

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 p-6">
        <div className="alert">
          <span>Loading record...</span>
        </div>
      </div>
    );
  }

  if (error || !selectedRecord || selectedRecords.length === 0) {
    return (
      <div className="min-h-screen bg-base-100 p-6 space-y-4">
        <div className="alert alert-error">
          <span>{error || "Record not found"}</span>
        </div>
        <button className="btn btn-primary" onClick={goBack}>
          Back to Notarial Records
        </button>
      </div>
    );
  }

  return (
    <NotarialEdit
      type="EDIT"
      selectedRecord={selectedRecord}
      selectedRecords={selectedRecords}
      onUpdate={async (entries: NotarialFormEntry[]) => {
        if (entries.length === 0) {
          return "No records to update.";
        }

        if (entries.length !== selectedRecords.length) {
          return "Record count mismatch. Please reload and try again.";
        }

        for (let index = 0; index < entries.length; index++) {
          const entry = entries[index];
          const target = selectedRecords[index];

          if (!target?.id) {
            return `Missing record id for row ${index + 1}.`;
          }

          const payload: Record<string, unknown> = {
            title: entry.title || null,
            name: entry.name || null,
            attorney: entry.atty || null,
            date: entry.date ? new Date(entry.date) : null,
            path: undefined,
            removeFile: undefined,
            file: entry.file ?? undefined,
          };

          const result = await updateNotarial(target.id, payload);
          if (!result.success) {
            return `Failed to update record ${index + 1}: ${result.error || "Unknown error"}`;
          }
        }

        return null;
      }}
      onClose={goBack}
    />
  );
};

export default NotarialEditPage;
