"use client";

import {
  getNotarialCommissionById,
  getNotarialCommissionsByIds,
} from "@/app/components/NotarialCommission/NotarialCommissionActions";
import NotarialCommissionDrawer, {
  NotarialCommissionDrawerType,
} from "@/app/components/NotarialCommission/NotarialCommissionDrawer";
import type { NotarialCommissionRecord } from "@/app/components/NotarialCommission/schema";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const NotarialCommissionEditPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedRecord, setSelectedRecord] =
    useState<NotarialCommissionRecord | null>(null);
  const [selectedRecords, setSelectedRecords] = useState<
    NotarialCommissionRecord[]
  >([]);
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

    const loadRecord = async () => {
      setLoading(true);

      if (ids.length === 0 && !idParam) {
        setError("Missing notarial commission id");
        setLoading(false);
        return;
      }

      if (ids.length > 0) {
        const result = await getNotarialCommissionsByIds(ids);
        if (!result.success) {
          setError(result.error || "Failed to load notarial commissions");
          setLoading(false);
          return;
        }
        if (!result.result) {
          setError("Failed to load notarial commissions");
          setLoading(false);
          return;
        }

        const loadedRecords = result.result as NotarialCommissionRecord[];
        setSelectedRecords(loadedRecords);
        setSelectedRecord(loadedRecords[0] ?? null);
        setError(null);
        setLoading(false);
        return;
      }

      const parsedId = Number(idParam);
      const result = await getNotarialCommissionById(parsedId);
      if (!result.success) {
        setError(result.error || "Failed to load notarial commission");
        setLoading(false);
        return;
      }
      if (!result.result) {
        setError("Failed to load notarial commission");
        setLoading(false);
        return;
      }

      const loadedRecord = result.result as NotarialCommissionRecord;
      setSelectedRecord(loadedRecord);
      setSelectedRecords([loadedRecord]);
      setError(null);
      setLoading(false);
    };

    void loadRecord();
  }, [searchParams]);

  const goBack = () => router.push("/user/notarial-commission");

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 p-6">
        <div className="alert">
          <span>Loading notarial commission...</span>
        </div>
      </div>
    );
  }

  if (error || !selectedRecord || selectedRecords.length === 0) {
    return (
      <div className="min-h-screen bg-base-100 p-6 space-y-4">
        <div className="alert alert-error">
          <span>{error || "Notarial commission not found"}</span>
        </div>
        <button className="btn btn-primary" onClick={goBack}>
          Back to Notarial Commission
        </button>
      </div>
    );
  }

  return (
    <NotarialCommissionDrawer
      type={NotarialCommissionDrawerType.EDIT}
      selectedRecord={selectedRecord}
      selectedRecords={selectedRecords}
      onClose={goBack}
    />
  );
};

export default NotarialCommissionEditPage;
