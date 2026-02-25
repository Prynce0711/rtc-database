"use client";

import { getCaseById } from "@/app/components/Case/CasesActions";
import type { Case } from "@/app/generated/prisma/browser";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function CaseDetailsPage() {
  const router = useRouter();
  const params = useParams();

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"details" | "additional">(
    "details",
  );

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  useEffect(() => {
    const fetchCase = async () => {
      try {
        setLoading(true);

        const id = Array.isArray(params.id) ? params.id[0] : params.id;
        const res = await getCaseById(Number(id));
        if (res.success) setCaseData(res.result);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) fetchCase();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="p-6">
        <button className="btn btn-ghost mb-4" onClick={() => router.back()}>
          ← Back
        </button>
        <div className="alert alert-error">Case not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      <div className="max-w-6xl mx-auto p-6">
        {/* HEADER */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="btn btn-ghost gap-2 mb-4"
          >
            ← Back
          </button>

          <h1 className="text-3xl font-bold">{caseData.caseNumber}</h1>
          <p className="text-base-content/60 mt-1">
            Filed: {formatDate(caseData.dateFiled)}
          </p>
        </div>

        {/* TABS */}
        <div className="tabs tabs-boxed bg-base-200 mb-6">
          <button
            className={`tab ${activeTab === "details" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("details")}
          >
            Case Details
          </button>
          <button
            className={`tab ${activeTab === "additional" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("additional")}
          >
            Additional Info
          </button>
        </div>

        {/* CONTENT */}
        <div className="bg-base-100 rounded-2xl border border-base-200 shadow-lg p-6">
          {activeTab === "details" && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Case Overview</h2>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* BASIC */}
                <Detail label="Case Number" value={caseData.caseNumber} />
                <Detail label="Branch" value={caseData.branch} />
                <Detail
                  label="Assistant Branch"
                  value={caseData.assistantBranch}
                />

                {/* CORE */}
                <Detail label="Accused" value={caseData.name} />
                <Detail label="Charge" value={caseData.charge} />
                <Detail label="Court" value={caseData.court} />
                <Detail label="Info Sheet" value={caseData.infoSheet} />

                {/* STATUS */}
                <div>
                  <p className="text-sm text-base-content/60 mb-1">
                    Detention Status
                  </p>

                  <div className="px-4 py-3 rounded-lg bg-base-200">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium
              ${
                caseData.detained
                  ? "bg-red-500/15 text-red-600 border border-red-400/30"
                  : "bg-emerald-500/15 text-emerald-600 border border-emerald-400/30"
              }`}
                    >
                      {caseData.detained ? "Detained" : "Free"}
                    </span>
                  </div>
                </div>

                <Detail label="Bond" value={caseData.bond} />
                <Detail label="EQC Number" value={caseData.eqcNumber} />
                <Detail label="Consolidation" value={caseData.consolidation} />

                {/* DATES */}
                <Detail
                  label="Date Filed"
                  value={formatDate(caseData.dateFiled)}
                />
                <Detail
                  label="Raffle Date"
                  value={formatDate(caseData.raffleDate)}
                />
              </div>
            </div>
          )}

          {activeTab === "additional" && (
            <div className="space-y-8">
              {/* PARTIES */}
              <div>
                <h2 className="text-lg font-semibold mb-4">Parties</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Detail label="Judge" value={caseData.Judge} />
                  <Detail label="AO" value={caseData.AO} />
                  <Detail label="Complainant" value={caseData.Complainant} />
                </div>
              </div>

              {/* COMMITTEE */}
              <div>
                <h2 className="text-lg font-semibold mb-4">Committee</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  <Detail label="Committee 1" value={caseData.committe1} />
                  <Detail label="Committee 2" value={caseData.committe2} />
                </div>
              </div>

              {/* ADDRESS */}
              <div>
                <h2 className="text-lg font-semibold mb-4">Address</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Detail label="House No." value={caseData.HouseNo} />
                  <Detail label="Street" value={caseData.Street} />
                  <Detail label="Barangay" value={caseData.Barangay} />
                  <Detail label="Municipality" value={caseData.Municipality} />
                  <Detail label="Province" value={caseData.Province} />
                </div>
              </div>

              {/* FINANCIAL */}
              <div>
                <h2 className="text-lg font-semibold mb-4">
                  Financial Details
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Detail label="Counts" value={caseData.Counts} />
                  <Detail label="JDF" value={caseData.Jdf} />
                  <Detail label="SAJJ" value={caseData.Sajj} />
                  <Detail label="SAJJ2" value={caseData.Sajj2} />
                  <Detail label="MF" value={caseData.MF} />
                  <Detail label="STF" value={caseData.STF} />
                  <Detail label="LRF" value={caseData.LRF} />
                  <Detail label="VCF" value={caseData.VCF} />
                  <Detail label="Total" value={caseData.Total} />
                  <Detail
                    label="Amount Involved"
                    value={caseData.AmountInvolved}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const Detail = ({ label, value }: { label: string; value: any }) => {
  const isEmpty =
    value === null || value === undefined || value === "" || value === "N/A";

  return (
    <div>
      <p className="text-sm text-base-content/60 mb-1">{label}</p>

      <div
        className={`px-4 py-3 rounded-lg text-sm
          ${
            isEmpty
              ? "bg-base-200/60 text-base-content/40 italic"
              : "bg-base-200 text-base-content font-medium"
          }`}
      >
        {isEmpty ? "No data available" : value}
      </div>
    </div>
  );
};
