"use client";

import React, { useEffect, useState } from "react";
import type { Case } from "../../generated/prisma/client";
import { getCases } from "../Case/CasesActions";
import DashboardLayout from "./DashboardLayout";
import { RecentCasesCard, StatsCard } from "./StaffCard";

const StaffDashboard: React.FC = () => {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch cases from API
  useEffect(() => {
    const fetchCases = async () => {
      try {
        setLoading(true);
        const response = await getCases();

        if (!response.success) {
          throw new Error(`HTTP error! status: ${response.error}`);
        }

        setCases(response.result);
      } catch (err) {
        console.error("Error fetching cases:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, []);

  // Calculate statistics
  const totalCases = cases.length;
  const detainedCases = cases.filter((c) => c.detained).length;
  const recentCases = cases.slice(0, 3);

  return (
    <DashboardLayout
      title="Welcome, Staff Member"
      subtitle="Manage your assigned cases and tasks"
    >
      <div className="flex">
        {/* Main Content */}
        <div className="flex-1">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : (
            <>
              {/* Dashboard Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatsCard
                  title="Total Cases"
                  value={totalCases}
                  borderColor="primary"
                />
                <StatsCard
                  title="Detained Cases"
                  value={detainedCases}
                  borderColor="warning"
                />
                <StatsCard
                  title="Not Detained"
                  value={totalCases - detainedCases}
                  borderColor="success"
                />
              </div>

              {/* Recent Cases */}
              <RecentCasesCard cases={recentCases} />
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StaffDashboard;
