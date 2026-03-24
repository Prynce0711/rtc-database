"use client";

import { getCivilCaseById } from "@/app/components/Case/Civil/CivilActions";
import { NotarialUpdatePage } from "@/app/components/Case/Civil/CivilCaseUpdatePage";
import {
  caseToRecord,
  type NotarialRecord,
} from "@/app/components/Case/Civil/CivilTypes";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const CivilEditPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedRecord, setSelectedRecord] = useState<NotarialRecord | null>(
    null,
  );
  const [selectedRecords, setSelectedRecords] = useState<NotarialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const idsParam = searchParams.get("ids");
    const idParam = searchParams.get("id");

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

    const loadCases = async () => {
      setLoading(true);

      if (ids.length > 0) {
        const results = await Promise.all(
          ids.map((id) => getCivilCaseById(id)),
        );
        const loadedRecords: NotarialRecord[] = [];

        for (const result of results) {
          if (!result.success || !result.result) {
            const message = !result.success
              ? result.error || "Failed to load case"
              : "Failed to load case";
            setError(message);
            setLoading(false);
            return;
          }
          loadedRecords.push(caseToRecord(result.result));
        }

        setSelectedRecords(loadedRecords);
        setSelectedRecord(loadedRecords[0] ?? null);
        setError(null);
        setLoading(false);
        return;
      }

      const result = await getCivilCaseById(idParam as string);
      if (!result.success || !result.result) {
        const message = !result.success
          ? result.error || "Failed to load case"
          : "Failed to load case";
        setError(message);
        setLoading(false);
        return;
      }

      const record = caseToRecord(result.result);
      setSelectedRecord(record);
      setSelectedRecords([record]);
      setError(null);
      setLoading(false);
    };

    void loadCases();
  }, [searchParams]);

  const goBackToList = () => {
    router.push("/user/cases/civil");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 p-6">
        <div className="alert">
          <span>Loading case...</span>
        </div>
      </div>
    );
  }

  if (error || !selectedRecord) {
    return (
      <div className="min-h-screen bg-base-100 p-6 space-y-4">
        <div className="alert alert-error">
          <span>{error || "Case not found"}</span>
        </div>
        <button className="btn btn-primary" onClick={goBackToList}>
          Back to Civil Cases
        </button>
      </div>
    );
  }

  return (
    <NotarialUpdatePage
      type="EDIT"
      selectedRecord={selectedRecord}
      selectedRecords={selectedRecords}
      onCloseAction={goBackToList}
      onCreateAction={goBackToList}
      onUpdateAction={goBackToList}
    />
  );
};

export default CivilEditPage;
