"use client";

import {
  Calendar,
  FileText,
  Lock,
  Scale,
  Server,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
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
  const [isVisible, setIsVisible] = useState(false);
  const statusPopup = usePopup();

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
      setTimeout(() => setIsVisible(true), 100);
    } catch (err) {
      console.error("Error fetching cases:", err);
    } finally {
      setLoading(false);
    }
  };

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
      detainedPercentage: total > 0 ? (detained / total) * 100 : 0,
    };
  }, [cases]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-center">
            <div className="relative mx-auto h-28 w-28 mb-8">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
              <div className="absolute inset-0 animate-pulse rounded-full bg-primary/50" />
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-primary shadow-2xl">
                <Server className="h-14 w-14 text-primary-content animate-pulse" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-base-content mb-2">
              Loading Staff Dashboard
            </h2>
            <p className="text-lg text-base-content/60">
              Fetching your assigned cases...
            </p>
            <div className="flex items-center justify-center gap-2 mt-4">
              {[0, 150, 300].map((delay) => (
                <div
                  key={delay}
                  className="h-2 w-2 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen">
        <div className="mx-auto w-full  ">
          <div className="space-y-6 sm:space-y-8">
            {/* HEADER */}
            <header className="bg-base-100">
              <div className="card-body p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-base-content">
                      Staff Dashboard
                    </h1>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm sm:text-base font-medium text-base-content/60">
                      <span className="flex items-center text-xl gap-2">
                        <span>Manage your assigned cases</span>
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </header>

            {/* KPI CARDS */}
            <section className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 text-center">
              {[
                {
                  label: "Total Cases",
                  value: stats.total,
                  subtitle: "Assigned to you",
                  icon: Scale,
                  color: "primary",
                  delay: 0,
                },
                {
                  label: "Detained",
                  value: stats.detained,
                  subtitle: `${stats.detainedPercentage.toFixed(1)}% of total`,
                  icon: Lock,
                  color: "primary",
                  delay: 100,
                },
                {
                  label: "Released",
                  value: stats.notDetained,
                  subtitle: "Not in detention",
                  icon: FileText,
                  color: "primary",
                  delay: 200,
                },
                {
                  label: "Pending Raffle",
                  value: stats.pending,
                  subtitle: "Needs assignment",
                  icon: Calendar,
                  color: "primary",
                  delay: 300,
                },
              ].map((card, idx) => (
                <div
                  key={idx}
                  className="card shadow-xl hover:shadow-2xl hover:scale-105 transition-all group"
                  style={{ transitionDelay: `${card.delay}ms` }}
                >
                  <div className="card-body p-4 sm:p-6 relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-32 w-32 -translate-y-8 translate-x-8 opacity-5 transition-all duration-500 group-hover:opacity-10 group-hover:scale-110">
                      <card.icon className="h-full w-full" />
                    </div>
                    <div className="relative">
                      <div className={`badge badge-${card.color} gap-2 mb-3`}>
                        <span className="font-bold uppercase text-xs">
                          {card.label}
                        </span>
                      </div>
                      <p className="text-4xl sm:text-5xl font-black text-base-content mb-2">
                        {card.value}
                      </p>
                      <p className="text-sm sm:text-base font-semibold text-base-content/60">
                        {card.subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </section>

            {/* INSIGHTS */}
            <section className="grid gap-6 lg:grid-cols-2">
              {/* Detention Rate */}
              <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                <div className="card-body p-4 sm:p-6">
                  <h2 className="card-title text-3xl font-black mb-3">
                    Detention Rate
                  </h2>

                  <div className="flex items-center gap-4 p-4 rounded-lg bg-base-200">
                    <div
                      className={`p-3 rounded-lg ${stats.detained > stats.notDetained ? "bg-warning/20" : "bg-success/20"}`}
                    >
                      {stats.detained > stats.notDetained ? (
                        <TrendingUp className="text-warning h-8 w-8" />
                      ) : (
                        <TrendingDown className="text-success h-8 w-8" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="text-2xl font-black text-base-content mb-1">
                        {stats.detainedPercentage.toFixed(1)}%
                      </div>
                      <p className="text-sm sm:text-base font-medium text-base-content/70">
                        of your cases involve detention
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <progress
                      className="progress progress-warning w-full h-3"
                      value={stats.detainedPercentage}
                      max="100"
                    />
                  </div>
                </div>
              </div>

              {/* Case Summary */}
              <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
                <div className="card-body p-4 sm:p-6">
                  <h2 className="card-title text-3xl font-black mb-3">
                    Case Summary
                  </h2>

                  <div className="space-y-3">
                    {[
                      {
                        label: "Total Assigned Cases",
                        value: stats.total,
                        color: "primary",
                      },
                      {
                        label: "Pending Raffle",
                        value: stats.pending,
                        color: "info",
                      },
                      {
                        label: "Detained Clients",
                        value: stats.detained,
                        color: "warning",
                      },
                      {
                        label: "Released Clients",
                        value: stats.notDetained,
                        color: "success",
                      },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg bg-base-200 transition-colors"
                      >
                        <span className="text-sm sm:text-base font-semibold text-base-content/70">
                          {item.label}
                        </span>
                        <span
                          className={`text-lg sm:text-xl font-black text-${item.color}`}
                        >
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* RECENT CASES */}
            <section className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
              <RecentCasesCard cases={stats.recent} view="table" />
            </section>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StaffDashboard;
