import React, { useState, useEffect } from "react";
import type { Case } from "../../../generated/prisma/client";

const StaffDashboard: React.FC = () => {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch cases from API
  useEffect(() => {
    const fetchCases = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/cases");

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setCases(data);
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
    <div className="min-h-screen bg-base-200">
      {/* Main Layout with Sidebar */}
      <div className="flex">
        {/* Main Content */}
        <main className="flex-1 px-4 py-8">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-base-content mb-2">
              Welcome, Staff Member
            </h2>
            <p className="opacity-70">Manage your assigned cases and tasks</p>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <span className="loading loading-spinner loading-lg"></span>
            </div>
          ) : (
            <>
              {/* Dashboard Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="card bg-base-100 shadow-xl border-l-4 border-primary">
                  <div className="card-body">
                    <h3 className="opacity-70 text-sm font-semibold">
                      Total Cases
                    </h3>
                    <p className="text-3xl font-bold">{totalCases}</p>
                  </div>
                </div>
                <div className="card bg-base-100 shadow-xl border-l-4 border-warning">
                  <div className="card-body">
                    <h3 className="opacity-70 text-sm font-semibold">
                      Detained Cases
                    </h3>
                    <p className="text-3xl font-bold">{detainedCases}</p>
                  </div>
                </div>
                <div className="card bg-base-100 shadow-xl border-l-4 border-success">
                  <div className="card-body">
                    <h3 className="opacity-70 text-sm font-semibold">
                      Not Detained
                    </h3>
                    <p className="text-3xl font-bold">
                      {totalCases - detainedCases}
                    </p>
                  </div>
                </div>
              </div>

              {/* Recent Cases */}
              <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                  <h3 className="card-title">Recent Cases</h3>
                  <div className="space-y-4">
                    {recentCases.length > 0 ? (
                      recentCases.map((caseItem) => (
                        <div
                          key={caseItem.id}
                          className={`border-l-4 ${
                            caseItem.detained
                              ? "border-error"
                              : "border-success"
                          } pl-4 py-2`}
                        >
                          <p className="font-semibold">
                            {caseItem.caseNumber} - {caseItem.charge}
                          </p>
                          <p className="text-sm opacity-70">
                            {caseItem.name} | Branch: {caseItem.branch}
                          </p>
                          <p className="text-sm opacity-70">
                            Filed:{" "}
                            {new Date(caseItem.dateFiled).toLocaleDateString()}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 opacity-70">
                        No cases found
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default StaffDashboard;
