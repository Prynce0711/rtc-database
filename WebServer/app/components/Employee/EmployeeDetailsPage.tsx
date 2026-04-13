"use client";

import { getEmployees } from "@/app/components/Employee/EmployeeActions";
import type { Employee } from "@/app/generated/prisma/browser";
import {
  DetailField,
  DetailSection,
  enumToText,
  formatLongDate,
  getAgeFromDate,
  isRetirementEligible,
  NavButton,
  PageDetailSkeleton,
} from "@rtc-database/shared";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function EmployeeDetailsPage() {
  const router = useRouter();
  const params = useParams();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"details" | "additional">(
    "details",
  );

  useEffect(() => {
    async function loadEmployee() {
      try {
        const res = await getEmployees();
        if (res.success) {
          const list: Employee[] = res.result;
          setAllEmployees(list);
          const emp = list.find((e) => e.id === Number(params.id));
          setEmployee(emp ?? null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadEmployee();
  }, [params.id]);

  // ── Adjacent employees ─────────────────────────────────────────────────────
  const currentIndex = allEmployees.findIndex(
    (e) => e.id === Number(params.id),
  );
  const prevEmployee = currentIndex > 0 ? allEmployees[currentIndex - 1] : null;
  const nextEmployee =
    currentIndex < allEmployees.length - 1
      ? allEmployees[currentIndex + 1]
      : null;

  const currentId = Array.isArray(params.id) ? params.id[0] : params.id;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return <PageDetailSkeleton />;
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!employee) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-base-content/30">
            Employee not found
          </p>
          <button
            onClick={() => router.back()}
            className="text-sm font-semibold text-primary hover:opacity-70 transition-opacity underline underline-offset-4"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-base-100 animate-fade-in">
      {/* ══════════════════════════════════════════
          TOPBAR
      ══════════════════════════════════════════ */}
      <header className="sticky top-0 z-50 bg-base-100/80 backdrop-blur-md border-b border-base-200">
        <div className="max-w-5xl mx-auto px-8 h-16 flex items-center justify-between gap-4">
          {/* Back */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[13px] font-semibold text-base-content/40 hover:text-base-content transition-colors duration-150 shrink-0"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 15 15"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M9.5 2.5L4.5 7.5L9.5 12.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[12px] font-semibold text-base-content/30 select-none">
            <span>Employees</span>
            <span className="opacity-40">/</span>
            <span className="text-base-content/55 font-bold truncate max-w-[180px]">
              {employee.employeeName}
            </span>
          </div>

          {/* Prev / Next compact */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() =>
                prevEmployee &&
                router.push(`/user/employees/${prevEmployee.id}`)
              }
              disabled={!prevEmployee}
              title={
                prevEmployee
                  ? `Previous: ${prevEmployee.employeeName}`
                  : "No previous employee"
              }
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base-content/35 hover:text-base-content hover:bg-base-200 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-150"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M9 2L4 7L9 12"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Counter */}
            <span className="text-[11px] font-bold text-base-content/25 tabular-nums px-2 select-none min-w-[36px] text-center">
              #{currentId}
            </span>

            <button
              onClick={() =>
                nextEmployee &&
                router.push(`/user/employees/${nextEmployee.id}`)
              }
              disabled={!nextEmployee}
              title={
                nextEmployee
                  ? `Next: ${nextEmployee.employeeName}`
                  : "No next employee"
              }
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base-content/35 hover:text-base-content hover:bg-base-200 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-150"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M5 2L10 7L5 12"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════
          MAIN
      ══════════════════════════════════════════ */}
      <main className="max-w-5xl mx-auto px-8 py-14 space-y-10">
        {/* ── Hero Block ───────────────────────────────────── */}
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary/55">
            Employee Record
          </p>
          <h1 className="text-[34px] font-bold text-base-content tracking-tight leading-tight">
            {employee.employeeName}
          </h1>
          <div className="flex items-center gap-4 flex-wrap">
            {employee.position && (
              <p className="text-[15px] text-base-content/45 font-medium">
                {employee.position}
              </p>
            )}
            {employee.branch && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold bg-base-200 text-base-content/50 border border-base-200">
                {employee.branch}
              </span>
            )}
            {employee.employeeNumber && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-semibold bg-primary/8 text-primary/70 border border-primary/10 font-mono">
                {employee.employeeNumber}
              </span>
            )}
          </div>
        </div>

        {/* ── Divider ──────────────────────────────────────── */}
        <div className="h-px bg-base-200" />

        {/* ── Tabs ─────────────────────────────────────────── */}
        <div className="flex items-end border-b border-base-200 gap-1">
          {(["details", "additional"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                "px-5 pb-3 pt-1 text-[13px] font-bold capitalize tracking-wide border-b-2 -mb-px transition-all duration-150 whitespace-nowrap",
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-base-content/30 hover:text-base-content/55",
              ].join(" ")}
            >
              {tab === "details" ? "Employee Details" : "Employment"}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════
            TAB — EMPLOYEE DETAILS
        ══════════════════════════════════════════ */}
        {activeTab === "details" && (
          <div className="space-y-10 animate-slide-up">
            <DetailSection
              label="Personal Information"
              titleClassName="text-[11px] font-bold uppercase tracking-[0.14em] text-base-content/30"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <DetailField
                  label="Employee Name"
                  value={employee.employeeName}
                  minHeightClass="min-h-[58px]"
                />
                <DetailField
                  label="Employee Number"
                  value={employee.employeeNumber}
                  mono
                  minHeightClass="min-h-[58px]"
                />
                <DetailField
                  label="Position"
                  value={employee.position}
                  minHeightClass="min-h-[58px]"
                />
                <DetailField
                  label="Branch"
                  value={employee.branch}
                  minHeightClass="min-h-[58px]"
                />
                <DetailField
                  label="Birthday"
                  value={formatLongDate(employee.birthDate)}
                  minHeightClass="min-h-[58px]"
                />
                <DetailField
                  label="Age"
                  value={getAgeFromDate(employee.birthDate) ?? "—"}
                  mono
                  minHeightClass="min-h-[58px]"
                />
                <DetailField
                  label="Date Hired"
                  value={formatLongDate(employee.dateHired)}
                  minHeightClass="min-h-[58px]"
                />
              </div>
            </DetailSection>

            <div className="h-px bg-base-200" />

            <DetailSection
              label="Contact Information"
              titleClassName="text-[11px] font-bold uppercase tracking-[0.14em] text-base-content/30"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <DetailField
                  label="Email"
                  value={employee.email}
                  minHeightClass="min-h-[58px]"
                />
                <DetailField
                  label="Contact Number"
                  value={employee.contactNumber}
                  mono
                  minHeightClass="min-h-[58px]"
                />
              </div>
            </DetailSection>
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB — ADDITIONAL INFO
        ══════════════════════════════════════════ */}
        {activeTab === "additional" && (
          <div className="space-y-10 animate-slide-up">
            <DetailSection
              label="Employment Details"
              titleClassName="text-[11px] font-bold uppercase tracking-[0.14em] text-base-content/30"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <DetailField
                  label="Employment Type"
                  value={
                    employee.employmentType
                      ? enumToText(employee.employmentType)
                      : null
                  }
                  minHeightClass="min-h-[58px]"
                />
                <DetailField
                  label="Retirement Eligible"
                  value={
                    isRetirementEligible(employee.birthDate) ? "Yes" : "No"
                  }
                  minHeightClass="min-h-[58px]"
                />
              </div>
            </DetailSection>
          </div>
        )}

        {/* ── Prev / Next bottom nav ────────────────────────── */}
        <div className="h-px bg-base-200" />
        <div className="flex items-stretch gap-3">
          <NavButton
            direction="prev"
            label={prevEmployee?.employeeName ?? "—"}
            sublabel={prevEmployee?.position ?? undefined}
            onClick={() =>
              prevEmployee && router.push(`/user/employees/${prevEmployee.id}`)
            }
            disabled={!prevEmployee}
          />
          <NavButton
            direction="next"
            label={nextEmployee?.employeeName ?? "—"}
            sublabel={nextEmployee?.position ?? undefined}
            onClick={() =>
              nextEmployee && router.push(`/user/employees/${nextEmployee.id}`)
            }
            disabled={!nextEmployee}
          />
        </div>

        {/* ── Footer meta ──────────────────────────────────── */}
        <div className="h-px bg-base-200" />
        <div className="flex items-center justify-between py-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-base-content/20 select-none">
            Employee Management System
          </p>
          {employee.employeeNumber && (
            <p className="text-[11px] text-base-content/20 font-semibold font-mono select-none">
              {employee.employeeNumber}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
