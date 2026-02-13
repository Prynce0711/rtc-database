"use client";

import { getEmployees } from "@/app/components/Employee/EmployeeActions";
import type { Employee } from "@/app/generated/prisma/browser";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function EmployeeDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"details" | "additional">(
    "details",
  );

  const bloodTypeMap: Record<string, string> = {
    A_Positive: "A+",
    A_Negative: "A-",
    B_Positive: "B+",
    B_Negative: "B-",
    AB_Positive: "AB+",
    AB_Negative: "AB-",
    O_Positive: "O+",
    O_Negative: "O-",
  };

  useEffect(() => {
    async function loadEmployee() {
      try {
        const res = await getEmployees();
        if (res.success) {
          const emp = res.result.find((e) => e.id === Number(params.id));
          if (emp) {
            setEmployee(emp);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadEmployee();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!employee) {
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
            <span>Employee not found</span>
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
                {employee.employeeName}
              </h1>
              <p className="text-base-content/60 mt-1">
                Last updated: {new Date().toLocaleDateString()}
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
            Employee Details
          </button>
          <button
            className={`tab ${activeTab === "additional" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("additional")}
          >
            Additional Info
          </button>
        </div>

        {/* Content */}
        <div className="bg-base-100 rounded-2xl border border-base-200 shadow-lg p-6">
          {activeTab === "details" && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Details</h2>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="text-sm font-medium text-base-content/70">
                    Employee Name
                  </label>
                  <div className="mt-1 px-4 py-3 bg-base-200 rounded-lg">
                    {employee.employeeName || "—"}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-base-content/70">
                    Employee Number
                  </label>
                  <div className="mt-1 px-4 py-3 bg-base-200 rounded-lg">
                    {employee.employeeNumber || "—"}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-base-content/70">
                    Position
                  </label>
                  <div className="mt-1 px-4 py-3 bg-base-200 rounded-lg">
                    {employee.position || "—"}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-base-content/70">
                    Branch
                  </label>
                  <div className="mt-1 px-4 py-3 bg-base-200 rounded-lg">
                    {employee.branch || "—"}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-base-content/70">
                    TIN
                  </label>
                  <div className="mt-1 px-4 py-3 bg-base-200 rounded-lg">
                    {employee.tinNumber || "—"}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-base-content/70">
                    GSIS
                  </label>
                  <div className="mt-1 px-4 py-3 bg-base-200 rounded-lg">
                    {employee.gsisNumber || "—"}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-base-content/70">
                    PhilHealth
                  </label>
                  <div className="mt-1 px-4 py-3 bg-base-200 rounded-lg">
                    {employee.philHealthNumber || "—"}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-base-content/70">
                    Pag-IBIG
                  </label>
                  <div className="mt-1 px-4 py-3 bg-base-200 rounded-lg">
                    {employee.pagIbigNumber || "—"}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-base-content/70">
                    Birthday
                  </label>
                  <div className="mt-1 px-4 py-3 bg-base-200 rounded-lg">
                    {employee.birthDate
                      ? new Date(employee.birthDate).toLocaleDateString()
                      : "—"}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-base-content/70">
                    Contact Person
                  </label>
                  <div className="mt-1 px-4 py-3 bg-base-200 rounded-lg">
                    {employee.contactPerson || "—"}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-base-content/70">
                    Contact Number
                  </label>
                  <div className="mt-1 px-4 py-3 bg-base-200 rounded-lg">
                    {employee.contactNumber || "—"}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-base-content/70">
                    Email
                  </label>
                  <div className="mt-1 px-4 py-3 bg-base-200 rounded-lg">
                    {employee.email || "—"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "additional" && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Additional Details</h2>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="text-sm font-medium text-base-content/70">
                    Blood Type
                  </label>
                  <div className="mt-1 px-4 py-3 bg-base-200 rounded-lg">
                    {employee.bloodType
                      ? bloodTypeMap[employee.bloodType]
                      : "—"}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-base-content/70">
                    Height (cm)
                  </label>
                  <div className="mt-1 px-4 py-3 bg-base-200 rounded-lg">
                    {employee.height ?? "—"}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-base-content/70">
                    Weight (kg)
                  </label>
                  <div className="mt-1 px-4 py-3 bg-base-200 rounded-lg">
                    {employee.weight ?? "—"}
                  </div>
                </div>

                <div className="md:col-span-2 lg:col-span-3">
                  <label className="text-sm font-medium text-base-content/70">
                    Allergies
                  </label>
                  <div className="mt-1 px-4 py-3 bg-base-200 rounded-lg">
                    {employee.allergies &&
                    employee.allergies.trim() !== "" &&
                    employee.allergies.toLowerCase() !== "n/a"
                      ? employee.allergies
                      : "N/A"}
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
