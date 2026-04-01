"use client";

import {
  getSheriffCaseById,
  getSheriffCasesByIds,
} from "@/app/components/Case/Sherriff/SherriffActions";
import { SherriffCaseUpdatePage } from "@/app/components/Case/Sherriff/SherriffCaseUpdatePage";
import {
  caseToRecord,
  type SheriffRecord,
} from "@/app/components/Case/Sherriff/SherriffTypes";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const SheriffEditPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedRecord, setSelectedRecord] = useState<SheriffRecord | null>(
    null,
  );
  const [selectedRecords, setSelectedRecords] = useState<SheriffRecord[]>([]);
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
        const result = await getSheriffCasesByIds(ids);
        if (!result.success || !result.result) {
          const message = !result.success
            ? result.error || "Failed to load cases"
            : "Failed to load cases";
          setError(message);
          setLoading(false);
          return;
        }

        const loadedRecords = result.result.map(caseToRecord);

        setSelectedRecords(loadedRecords);
        setSelectedRecord(loadedRecords[0] ?? null);
        setError(null);
        setLoading(false);
        return;
      }

      const result = await getSheriffCaseById(idParam as string);
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
    router.push("/user/cases/sheriff");
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
          Back to Sheriff Cases
        </button>
      </div>
    );
  }

  return (
    <SherriffCaseUpdatePage
      type="EDIT"
      selectedRecord={selectedRecord}
      selectedRecords={selectedRecords}
      onCloseAction={goBackToList}
      onCreateAction={goBackToList}
      onUpdateAction={goBackToList}
    />
  );
};

export default SheriffEditPage;
