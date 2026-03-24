"use client";

import {
  getPetitionById,
  getPetitionsByIds,
} from "@/app/components/Case/Petition/PetitionActions";
import PetitionEntryPage, {
  ReceiveDrawerType,
} from "@/app/components/Case/Petition/PetitionDrawer";
import type { PetitionCaseData } from "@/app/components/Case/Petition/schema";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const PetitionEditPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedLog, setSelectedLog] = useState<PetitionCaseData | null>(null);
  const [selectedLogs, setSelectedLogs] = useState<PetitionCaseData[]>([]);
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

    const loadCase = async () => {
      setLoading(true);

      if (ids.length > 0) {
        const result = await getPetitionsByIds(ids);
        if (!result.success || !result.result) {
          const message =
            !result.success && "error" in result
              ? result.error || "Failed to load petition"
              : "Failed to load petition";
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
      const result = await getPetitionById(parsedId);

      if (!result.success || !result.result) {
        const message =
          !result.success && "error" in result
            ? result.error || "Failed to load petition"
            : "Failed to load petition";
        setError(message);
        setLoading(false);
        return;
      }

      setSelectedLog(result.result);
      setSelectedLogs([result.result]);
      setError(null);
      setLoading(false);
    };

    void loadCase();
  }, [searchParams]);

  const goBack = () => router.push("/user/cases/petition");

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 p-6">
        <div className="alert">
          <span>Loading case...</span>
        </div>
      </div>
    );
  }

  if (error || !selectedLog || selectedLogs.length === 0) {
    return (
      <div className="min-h-screen bg-base-100 p-6 space-y-4">
        <div className="alert alert-error">
          <span>{error || "Case not found"}</span>
        </div>
        <button className="btn btn-primary" onClick={goBack}>
          Back to Petitions
        </button>
      </div>
    );
  }

  return (
    <PetitionEntryPage
      type={ReceiveDrawerType.EDIT}
      selectedLog={selectedLog}
      selectedLogs={selectedLogs}
      onClose={goBack}
    />
  );
};

export default PetitionEditPage;
