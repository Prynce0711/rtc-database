"use client";

import { getEmployees } from "@/app/components/Employee/EmployeeActions";
import type { Employee } from "@/app/generated/prisma/browser";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// ─── Detail Field ─────────────────────────────────────────────────────────────
const Detail = ({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: any;
  mono?: boolean;
}) => {
  const isEmpty =
    value === null ||
    value === undefined ||
    value === "" ||
    value === "N/A" ||
    (typeof value === "string" && value.trim().toLowerCase() === "n/a");

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-base-content/30 select-none">
        {label}
      </span>
      <div
        className={[
          "px-5 py-4 rounded-xl border min-h-[58px] flex items-center",
          isEmpty
            ? "bg-base-200/40 border-base-200/60"
            : "bg-base-200/70 border-base-200",
        ].join(" ")}
      >
        <span
          className={[
            "leading-relaxed",
            isEmpty
              ? "text-[13px] italic text-base-content/25 font-normal"
              : mono
                ? "font-mono text-[13px] text-base-content/60"
                : "text-[15px] font-semibold text-base-content",
          ].join(" ")}
        >
          {isEmpty ? "—" : String(value)}
        </span>
      </div>
    </div>
  );
};

// ─── Section Block ────────────────────────────────────────────────────────────
const Section = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-5">
    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-base-content/30">
      {label}
    </p>
    {children}
  </div>
);

// ─── Nav Button ───────────────────────────────────────────────────────────────
const NavButton = ({
  direction,
  label,
  sublabel,
  onClick,
  disabled,
}: {
  direction: "prev" | "next";
  label: string;
  sublabel?: string;
  onClick: () => void;
  disabled: boolean;
}) => {
  const isPrev = direction === "prev";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        "group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-150 min-w-0 flex-1",
        disabled
          ? "opacity-25 cursor-not-allowed border-base-200 bg-transparent"
          : "border-base-200 bg-base-100 hover:bg-base-200/60 hover:border-base-content/15",
        !isPrev ? "flex-row-reverse" : "",
      ].join(" ")}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        className="shrink-0 text-base-content/30 group-hover:text-base-content/60 transition-colors"
        aria-hidden="true"
      >
        {isPrev ? (
          <path
            d="M10 3L5 8L10 13"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M6 3L11 8L6 13"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <div
        className={["min-w-0", !isPrev ? "items-end flex flex-col" : ""].join(
          " ",
        )}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/25 select-none leading-none mb-1">
          {isPrev ? "Previous" : "Next"}
        </p>
        <p className="text-[13px] font-bold text-base-content/60 group-hover:text-base-content truncate max-w-[200px] transition-colors leading-snug">
          {label}
        </p>
        {sublabel && (
          <p className="text-[11px] text-base-content/30 truncate max-w-[200px] leading-snug mt-0.5">
            {sublabel}
          </p>
        )}
      </div>
    </button>
  );
};

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
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="loading loading-spinner loading-md text-primary/40" />
          <p className="text-[12px] font-bold uppercase tracking-widest text-base-content/25 select-none">
            Loading employee…
          </p>
        </div>
      </div>
    );
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
            onClick={() => router.push("/user/employees")}
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
            onClick={() => router.push("/user/employees")}
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
              {tab === "details" ? "Employee Details" : "Additional Info"}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════
            TAB — EMPLOYEE DETAILS
        ══════════════════════════════════════════ */}
        {activeTab === "details" && (
          <div className="space-y-10 animate-slide-up">
            <Section label="Personal Information">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <Detail label="Employee Name" value={employee.employeeName} />
                <Detail
                  label="Employee Number"
                  value={employee.employeeNumber}
                  mono
                />
                <Detail label="Position" value={employee.position} />
                <Detail label="Branch" value={employee.branch} />
                <Detail
                  label="Birthday"
                  value={formatDate(employee.birthDate)}
                />
              </div>
            </Section>

            <div className="h-px bg-base-200" />

            <Section label="Government IDs">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <Detail label="TIN" value={employee.tinNumber} mono />
                <Detail label="GSIS" value={employee.gsisNumber} mono />
                <Detail
                  label="PhilHealth"
                  value={employee.philHealthNumber}
                  mono
                />
                <Detail label="Pag-IBIG" value={employee.pagIbigNumber} mono />
              </div>
            </Section>

            <div className="h-px bg-base-200" />

            <Section label="Contact Information">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <Detail label="Email" value={employee.email} />
                <Detail label="Contact Person" value={employee.contactPerson} />
                <Detail
                  label="Contact Number"
                  value={employee.contactNumber}
                  mono
                />
              </div>
            </Section>
          </div>
        )}

        {/* ══════════════════════════════════════════
            TAB — ADDITIONAL INFO
        ══════════════════════════════════════════ */}
        {activeTab === "additional" && (
          <div className="space-y-10 animate-slide-up">
            <Section label="Physical Information">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <Detail
                  label="Blood Type"
                  value={
                    employee.bloodType
                      ? (bloodTypeMap[employee.bloodType] ?? employee.bloodType)
                      : null
                  }
                />
                <Detail label="Height (cm)" value={employee.height ?? null} />
                <Detail label="Weight (kg)" value={employee.weight ?? null} />
              </div>
            </Section>

            <div className="h-px bg-base-200" />

            <Section label="Medical Notes">
              <div className="grid grid-cols-1 gap-5">
                <Detail label="Allergies" value={employee.allergies} />
              </div>
            </Section>
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
