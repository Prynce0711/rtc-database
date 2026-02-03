import React from "react";

const AdminDashboard: React.FC = () => {
  return (
    <div className="min-h-screen bg-base-200">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-base-content mb-2">
            Welcome, Administrator
          </h2>
          <p className="opacity-70">Manage court operations and personnel</p>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card bg-base-100 shadow-xl border-l-4 border-primary">
            <div className="card-body">
              <h3 className="opacity-70 text-sm font-semibold">Total Cases</h3>
              <p className="text-3xl font-bold">1,234</p>
            </div>
          </div>
          <div className="card bg-base-100 shadow-xl border-l-4 border-success">
            <div className="card-body">
              <h3 className="opacity-70 text-sm font-semibold">Active Cases</h3>
              <p className="text-3xl font-bold">856</p>
            </div>
          </div>
          <div className="card bg-base-100 shadow-xl border-l-4 border-warning">
            <div className="card-body">
              <h3 className="opacity-70 text-sm font-semibold">Pending</h3>
              <p className="text-3xl font-bold">342</p>
            </div>
          </div>
          <div className="card bg-base-100 shadow-xl border-l-4 border-secondary">
            <div className="card-body">
              <h3 className="opacity-70 text-sm font-semibold">
                Staff Members
              </h3>
              <p className="text-3xl font-bold">28</p>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h3 className="card-title">Recent Activity</h3>
            <div className="space-y-4">
              <div className="border-l-4 border-primary pl-4 py-2">
                <p className="font-semibold">New case filed: Case #2026-001</p>
                <p className="text-sm opacity-70">2 hours ago</p>
              </div>
              <div className="border-l-4 border-success pl-4 py-2">
                <p className="font-semibold">Case #2025-892 resolved</p>
                <p className="text-sm opacity-70">5 hours ago</p>
              </div>
              <div className="border-l-4 border-warning pl-4 py-2">
                <p className="font-semibold">Staff meeting scheduled</p>
                <p className="text-sm opacity-70">1 day ago</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
