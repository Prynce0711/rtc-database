"use client";

import type { SpecialCase } from "@/app/generated/prisma/browser";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProceedingDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const [caseData, setCaseData] = useState<SpecialCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"details" | "parties">("details");
  const MOCK_CASES = [
    {
      id: 1,
      spcNo: "SPC-2024-0001",
      raffledToBranch: "Branch 1",
      dateFiled: "2024-01-15",
      petitioners: "Juan Dela Cruz",
      nature: "Petition for Adoption",
      respondent: "Republic of the Philippines",
    },
    {
      id: 2,
      spcNo: "SPC-2024-0002",
      raffledToBranch: "Branch 3",
      dateFiled: "2024-02-20",
      petitioners: "Maria Santos",
      nature: "Petition for Guardianship",
      respondent: "Pedro Santos",
    },
    {
      id: 3,
      spcNo: "SPC-2024-0003",
      raffledToBranch: "Branch 2",
      dateFiled: "2024-03-05",
      petitioners: "Jose Reyes",
      nature: "Petition for Change of Name",
      respondent: "Republic of the Philippines",
    },
    {
      id: 4,
      spcNo: "SPC-2024-0004",
      raffledToBranch: "Branch 5",
      dateFiled: "2024-03-18",
      petitioners: "Ana Lim",
      nature: "Petition for Annulment",
      respondent: "Carlos Lim",
    },
    {
      id: 5,
      spcNo: "SPC-2024-0005",
      raffledToBranch: "Branch 1",
      dateFiled: "2024-04-01",
      petitioners: "Roberto Garcia",
      nature: "Petition for Habeas Corpus",
      respondent: "Bureau of Corrections",
    },
    {
      id: 6,
      spcNo: "SPC-2024-0006",
      raffledToBranch: "Branch 4",
      dateFiled: "2024-04-22",
      petitioners: "Elena Cruz",
      nature: "Petition for Declaration of Nullity",
      respondent: "Rodrigo Cruz",
    },
    {
      id: 7,
      spcNo: "SPC-2024-0007",
      raffledToBranch: "Branch 2",
      dateFiled: "2024-05-10",
      petitioners: "Marco Villanueva",
      nature: "Petition for Adoption",
      respondent: "Republic of the Philippines",
    },
    {
      id: 8,
      spcNo: "SPC-2024-0008",
      raffledToBranch: "Branch 3",
      dateFiled: "2024-05-28",
      petitioners: "Lourdes Fernandez",
      nature: "Petition for Legal Separation",
      respondent: "Ernesto Fernandez",
    },
    {
      id: 9,
      spcNo: "SPC-2024-0009",
      raffledToBranch: "Branch 1",
      dateFiled: "2024-06-03",
      petitioners: "Dante Morales",
      nature: "Petition for Guardianship",
      respondent: "City Social Welfare",
    },
    {
      id: 10,
      spcNo: "SPC-2024-0010",
      raffledToBranch: "Branch 5",
      dateFiled: "2024-06-15",
      petitioners: "Carmen Bautista",
      nature: "Petition for Change of Name",
      respondent: "Republic of the Philippines",
    },
  ];
  const formatDate = (dateStr: string | Date | null | undefined) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  useEffect(() => {
    const found = MOCK_CASES.find((c) => c.id === Number(params.id));

    setCaseData(found || null);
    setLoading(false);
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-base-100 p-8">
        <div className="max-w-5xl mx-auto">
          <button
            onClick={() => router.back()}
            className="btn btn-ghost gap-2 mb-4"
          >
            ← Back
          </button>
          <div className="alert alert-error">
            <span>Case not found</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="btn btn-ghost gap-2 mb-4"
          >
            ← Back
          </button>

          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-base-content">
                {caseData.spcNo}
              </h1>
              <p className="text-base-content/60 mt-1">
                Filed: {formatDate(caseData.dateFiled)}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs tabs-boxed bg-base-200 mb-6">
          <button
            className={`tab ${activeTab === "details" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("details")}
          >
            Case Details
          </button>
          <button
            className={`tab ${activeTab === "parties" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("parties")}
          >
            Parties & Nature
          </button>
        </div>

        {/* Content */}
        <div className="bg-base-100 rounded-2xl border border-base-200 shadow-lg p-6">
          {activeTab === "details" && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Case Information</h2>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="text-sm font-medium text-base-content/70">
                    SPC. No.
                  </label>
                  <div className="mt-1 px-4 py-3 bg-base-200 rounded-lg">
                    {caseData.spcNo || "—"}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-base-content/70">
                    Raffled to Branch
                  </label>
                  <div className="mt-1 px-4 py-3 bg-base-200 rounded-lg">
                    {caseData.raffledToBranch || "—"}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-base-content/70">
                    Date Filed
                  </label>
                  <div className="mt-1 px-4 py-3 bg-base-200 rounded-lg">
                    {formatDate(caseData.dateFiled)}
                  </div>
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <label className="text-sm font-medium text-base-content/70">
                    Nature of Petition
                  </label>
                  <div className="mt-1 px-4 py-3 bg-base-200 rounded-lg">
                    {caseData.nature || "—"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "parties" && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Parties Involved</h2>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="text-sm font-medium text-base-content/70">
                    Petitioners
                  </label>
                  <div className="mt-1 px-4 py-3 bg-base-200 rounded-lg">
                    {caseData.petitioners || "—"}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-base-content/70">
                    Respondent
                  </label>
                  <div className="mt-1 px-4 py-3 bg-base-200 rounded-lg">
                    {caseData.respondent || "—"}
                  </div>
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <label className="text-sm font-medium text-base-content/70">
                    Nature of Petition
                  </label>
                  <div className="mt-1 px-4 py-3 bg-base-200 rounded-lg">
                    {caseData.nature || "—"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
