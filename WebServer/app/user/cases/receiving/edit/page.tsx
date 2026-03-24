"use client";

import ReceiveDrawer, {
  ReceiveDrawerType,
} from "@/app/components/Case/ReceivingLogs/ReceiveDrawer";
import {
  getRecievingLogById,
  getRecievingLogsByIds,
} from "@/app/components/Case/ReceivingLogs/RecievingLogsActions";
import { RecievingLog } from "@/app/generated/prisma/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const ReceivingEditPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedLog, setSelectedLog] = useState<RecievingLog | null>(null);
  const [selectedLogs, setSelectedLogs] = useState<RecievingLog[]>([]);
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

    const loadLog = async () => {
      setLoading(true);

      if (ids.length > 0) {
        const result = await getRecievingLogsByIds(ids);
        if (!result.success || !result.result) {
          const message =
            !result.success && "error" in result
              ? result.error || "Failed to load receiving log"
              : "Failed to load receiving log";
          setError(message);
          setLoading(false);
          return;
        }

        const loadedLogs = result.result;

        setSelectedLogs(loadedLogs);
        setSelectedLog(loadedLogs[0] ?? null);
        setError(null);
        setLoading(false);
        return;
      }

      const parsedId = Number(idParam);
      const result = await getRecievingLogById(parsedId);

      if (!result.success || !result.result) {
        const message =
          !result.success && "error" in result
            ? result.error || "Failed to load receiving log"
            : "Failed to load receiving log";
        setError(message);
        setLoading(false);
        return;
      }

      setSelectedLog(result.result);
      setSelectedLogs([result.result]);
      setError(null);
      setLoading(false);
    };

    void loadLog();
  }, [searchParams]);

  const goBack = () => router.push("/user/cases/receiving");

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 p-6">
        <div className="alert">
          <span>Loading entry...</span>
        </div>
      </div>
    );
  }

  if (error || !selectedLog || selectedLogs.length === 0) {
    return (
      <div className="min-h-screen bg-base-100 p-6 space-y-4">
        <div className="alert alert-error">
          <span>{error || "Entry not found"}</span>
        </div>
        <button className="btn btn-primary" onClick={goBack}>
          Back to Receiving Logs
        </button>
      </div>
    );
  }

  return (
    <ReceiveDrawer
      type={ReceiveDrawerType.EDIT}
      selectedLog={selectedLog}
      selectedLogs={selectedLogs}
      onClose={goBack}
    />
  );
};

export default ReceivingEditPage;
