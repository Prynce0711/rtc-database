"use client";

import CriminalCaseUpdatePage from "@/app/components/Case/Criminal/CriminalCaseUpdatePage";
import { getCriminalCaseById } from "@/app/components/Case/Criminal/CriminalCasesActions";
import type { CriminalCaseData } from "@/app/components/Case/Criminal/schema";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const CriminalEditPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedCase, setSelectedCase] = useState<CriminalCaseData | null>(
    null,
  );
  const [selectedCases, setSelectedCases] = useState<CriminalCaseData[]>([]);
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

    const loadCase = async () => {
      setLoading(true);

      if (ids.length > 0) {
        const results = await Promise.all(
          ids.map((id) => getCriminalCaseById(id)),
        );
        const loadedCases: CriminalCaseData[] = [];

        for (const result of results) {
          if (!result.success || !result.result) {
            const message = !result.success
              ? result.error || "Failed to load case"
              : "Failed to load case";
            setError(message);
            setLoading(false);
            return;
          }
          loadedCases.push(result.result);
        }

        setSelectedCases(loadedCases);
        setSelectedCase(loadedCases[0] ?? null);
        setError(null);
        setLoading(false);
        return;
      }

      const result = await getCriminalCaseById(idParam as string);

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

    void loadCase();
  }, [searchParams]);

  const goBackToList = () => {
    router.push("/user/cases/criminal");
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
          Back to Criminal Cases
        </button>
      </div>
    );
  }

  return (
    <CriminalCaseUpdatePage
      selectedCase={selectedCase}
      selectedCases={selectedCases}
      onClose={goBackToList}
      onCreate={goBackToList}
      onUpdate={goBackToList}
    />
  );
};

export default CriminalEditPage;
