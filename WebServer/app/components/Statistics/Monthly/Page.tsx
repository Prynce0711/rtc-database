"use client";

export default function MonthlyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-base-content">
          Monthly Reports
        </h1>
        <p className="text-base-content/60 mt-2">
          View monthly statistics and reports
        </p>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Monthly Statistics</h2>
          <p>Monthly reports content will be displayed here.</p>
        </div>
      </div>
    </div>
  );
}
