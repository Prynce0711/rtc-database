import React from "react";

interface AdminDashboardProps {
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img
              src="/SupremeCourtLogo.webp"
              alt="Supreme Court"
              className="w-12 h-12 object-contain"
            />
            <div>
              <h1 className="text-xl font-bold">Regional Trial Court</h1>
              <p className="text-sm text-blue-200">Administrator Dashboard</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-white text-blue-900 rounded-md font-semibold hover:bg-blue-50 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome, Administrator
          </h2>
          <p className="text-gray-600">Manage court operations and personnel</p>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-900">
            <h3 className="text-gray-600 text-sm font-semibold mb-2">
              Total Cases
            </h3>
            <p className="text-3xl font-bold text-gray-900">1,234</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-600">
            <h3 className="text-gray-600 text-sm font-semibold mb-2">
              Active Cases
            </h3>
            <p className="text-3xl font-bold text-gray-900">856</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-yellow-600">
            <h3 className="text-gray-600 text-sm font-semibold mb-2">
              Pending
            </h3>
            <p className="text-3xl font-bold text-gray-900">342</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-600">
            <h3 className="text-gray-600 text-sm font-semibold mb-2">
              Staff Members
            </h3>
            <p className="text-3xl font-bold text-gray-900">28</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            Recent Activity
          </h3>
          <div className="space-y-4">
            <div className="border-l-4 border-blue-900 pl-4 py-2">
              <p className="font-semibold text-gray-900">
                New case filed: Case #2026-001
              </p>
              <p className="text-sm text-gray-600">2 hours ago</p>
            </div>
            <div className="border-l-4 border-green-600 pl-4 py-2">
              <p className="font-semibold text-gray-900">
                Case #2025-892 resolved
              </p>
              <p className="text-sm text-gray-600">5 hours ago</p>
            </div>
            <div className="border-l-4 border-yellow-600 pl-4 py-2">
              <p className="font-semibold text-gray-900">
                Staff meeting scheduled
              </p>
              <p className="text-sm text-gray-600">1 day ago</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
