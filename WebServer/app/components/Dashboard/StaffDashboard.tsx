"use client";

import { Server, TrendingDown, TrendingUp } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import type { Case } from "../../generated/prisma/client";
import { getCases } from "../Case/CasesActions";
import { usePopup } from "../Popup/PopupProvider";
import DashboardLayout from "./DashboardLayout";
import { RecentCasesCard } from "./StaffCard";

interface Props {
  staffId?: string;
}

const StaffDashboard: React.FC<Props> = ({ staffId }) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const statusPopup = usePopup();
  // Fetch cases from API
  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      setLoading(true);
      const response = await getCases();

      if (!response.success) {
        statusPopup.showError(response.error || "Failed to fetch cases");
        return;
      }

      setCases(response.result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch cases");
      console.error("Error fetching cases:", err);
    } finally {
      setLoading(false);
    }
  };

  /* ================= STATS ================= */
  const stats = useMemo(() => {
    const total = cases.length;
    const detained = cases.filter((c) => c.detained).length;
    const pending = cases.filter((c) => !c.raffleDate).length;

    return {
      total,
      detained,
      notDetained: total - detained,
      pending,
      recent: cases.slice(0, 5),
    };
  }, [cases]);

  /* ================= LOADING ================= */
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="relative mx-auto h-20 w-20">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary opacity-70" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary">
                <Server className="h-10 w-10 text-white" />
              </div>
            </div>

            <p className="mt-6 text-xl font-bold">Loading Staff Dashboard</p>
            <p className="text-base opacity-60">Fetching your assigned cases</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Staff Dashboard"
      subtitle="Manage your assigned cases"
    >
      <div className="space-y-8">
        {/* ================= KPI CARDS ================= */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 text-center">
          {/* TOTAL */}
          <div className="rounded-2xl bg-base-300 p-6 shadow-lg hover:scale-[1.02] transition">
            <p className="text-base uppercase font-bold opacity-70">
              Total Cases
            </p>
            <p className="text-5xl font-black text-primary mt-3">
              {stats.total}
            </p>
            <p className="mt-3 text-base font-semibold text-base-content/50">
              this month
            </p>
          </div>

          {/* DETAINED */}
          <div className="rounded-2xl bg-base-300 p-6 shadow-lg hover:scale-[1.02] transition">
            <p className="text-base uppercase font-bold opacity-70">Detained</p>
            <p className="text-5xl font-black text-primary mt-3">
              {stats.detained}
            </p>
            <p className="mt-3 text-base font-semibold text-base-content/50">
              50.0% of total
            </p>
          </div>

          {/* NOT DETAINED */}
          <div className="rounded-2xl bg-base-300 p-6 shadow-lg hover:scale-[1.02] transition">
            <p className="text-base uppercase font-bold opacity-70">Released</p>
            <p className="text-5xl font-black text-primary mt-3">
              {stats.notDetained}
            </p>{" "}
            <p className="mt-3 text-base font-semibold text-base-content/50">
              this month
            </p>
          </div>

          {/* PENDING */}
          <div className="rounded-2xl bg-base-300 p-6 shadow-lg hover:scale-[1.02] transition">
            <p className="text-base uppercase font-bold opacity-70">
              Pending Raffle
            </p>
            <p className="text-5xl font-black text-primary mt-3">
              {stats.pending}
            </p>{" "}
            <p className="mt-3 text-base font-semibold text-base-content/50">
              0 pending raffle
            </p>
          </div>
        </div>

        {/* ================= SIMPLE INSIGHTS ================= */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Detention Rate */}
          <div className="rounded-2xl bg-base-100 border border-base-300 p-6 shadow">
            <h2 className="text-2xl font-black mb-3">Detention Rate</h2>

            <div className="flex items-center gap-4">
              {stats.detained > stats.notDetained ? (
                <TrendingUp className="text-warning" size={32} />
              ) : (
                <TrendingDown className="text-success" size={32} />
              )}

              <p className="text-lg font-medium text-base-content/70">
                {stats.total > 0
                  ? ((stats.detained / stats.total) * 100).toFixed(1)
                  : 0}
                % of your cases involve detention
              </p>
            </div>
          </div>

          {/* Case Summary */}
          <div className="rounded-2xl bg-base-100 border border-base-300 p-6 shadow">
            <h2 className="text-2xl font-black mb-3">Case Summary</h2>

            <ul className="space-y-2 text-lg font-medium text-base-content/70">
              <li>Total Assigned Cases: {stats.total}</li>
              <li>Pending Raffle: {stats.pending}</li>
              <li>Detained Clients: {stats.detained}</li>
              <li>Released Clients: {stats.notDetained}</li>
            </ul>
          </div>
        </div>

        {/* ================= RECENT CASES ================= */}
        <RecentCasesCard cases={stats.recent} view="table" />
      </div>
    </DashboardLayout>
  );
};

export default StaffDashboard;
