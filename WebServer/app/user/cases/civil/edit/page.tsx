"use client";

import {
  getCivilCaseById,
  getCivilCasesByIds,
} from "@/app/components/Case/Civil/CivilActions";
import { civilCaseAdapter } from "@/app/components/Case/Civil/CivilCaseAdapter";
import { CivilCaseData, CivilCaseUpdatePage } from "@rtc-database/shared";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const CivilEditPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedCase, setSelectedCase] = useState<CivilCaseData | null>(null);
  const [selectedCases, setSelectedCases] = useState<CivilCaseData[]>([]);
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
        const result = await getCivilCasesByIds(ids);
        if (!result.success || !result.result) {
          const message = !result.success
            ? result.error || "Failed to load cases"
            : "Failed to load cases";
          setError(message);
          setLoading(false);
          return;
        }

        setSelectedCases(result.result);
        setSelectedCase(result.result[0] ?? null);
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

      setSelectedCase(result.result);
      setSelectedCases([result.result]);
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

  if (error || !selectedCase) {
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
    <CivilCaseUpdatePage
      selectedCase={selectedCase}
      selectedCases={selectedCases}
      onClose={goBackToList}
      onCreate={goBackToList}
      onUpdate={goBackToList}
      adapter={civilCaseAdapter}
    />
  );
};

export default CivilEditPage;
