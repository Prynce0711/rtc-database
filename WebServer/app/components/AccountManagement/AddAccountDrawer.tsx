"use client";

import { User } from "@/app/generated/prisma/browser";
import { Employee } from "@/app/generated/prisma/client";
import Roles from "@/app/lib/Roles";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheck,
  FiChevronRight,
  FiEdit3,
  FiEye,
  FiMail,
  FiSave,
  FiUser,
  FiUserPlus,
} from "react-icons/fi";
import { getEmployees } from "../Employee/EmployeeActions";
import { usePopup } from "../Popup/PopupProvider";
import { createAccount } from "./AccountActions";
import { NewUserSchema } from "./schema";

type AccountType = "EXISTING" | "NEW" | null;
type Step = "SELECT_TYPE" | "FORM" | "REVIEW";

const AddAccountDrawer = ({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (user: User) => void;
}) => {
  const statusPopup = usePopup();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [step, setStep] = useState<Step>("SELECT_TYPE");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<
    NewUserSchema & { selectedEmployeeId?: number }
  >({
    name: "",
    email: "",
    role: Roles.USER,
  });

  useEffect(() => {
    getEmployees().then((result) => {
      if (result.success) setEmployees(result.result);
      else statusPopup.showError("Failed to fetch employees");
    });
  }, []);

  const handleEmployeeSelect = (employeeId: number) => {
    const employee = employees.find((e) => e.id === employeeId);
    if (employee) {
      setForm({
        ...form,
        name: employee.employeeName,
        email: employee.email || "",
        selectedEmployeeId: employeeId,
      });
    }
  };

  const handleCreate = async () => {
    if (!(await statusPopup.showConfirm("Create this account?"))) return;

    setLoading(true);
    statusPopup.showLoading("Creating account...");

    const result = await createAccount(form);
    setLoading(false);

    if (!result.success) {
      statusPopup.showError(result.error || "Failed to create account");
      statusPopup.hidePopup();
      return;
    }

    statusPopup.showSuccess("Account created. Activation link sent.");
    onCreate(result.result);
  };

  const canProceedToReview = () => {
    if (accountType === "EXISTING") return form.selectedEmployeeId && form.role;
    return form.name && form.email && form.role;
  };

  const handleBack = () => {
    if (step === "REVIEW") setStep("FORM");
    else if (step === "FORM") {
      setStep("SELECT_TYPE");
      setAccountType(null);
      setForm({ name: "", email: "", role: Roles.USER });
    } else {
      onClose();
    }
  };

  const isReview = step === "REVIEW";

  return (
    <div className="xls-root">
      {/* ══ TOPBAR ══ */}
      <div className="bg-base-100 xls-topbar">
        <div className="xls-topbar-left">
          <button className="xls-back-btn" onClick={handleBack} title="Back">
            <FiArrowLeft size={16} />
          </button>
          <nav className="xls-breadcrumb">
            <span>Accounts</span>
            <FiChevronRight size={12} className="xls-breadcrumb-sep" />
            <span className="xls-breadcrumb-current">Add Account</span>
            {step !== "SELECT_TYPE" && (
              <>
                <FiChevronRight size={12} className="xls-breadcrumb-sep" />
                <span className="xls-breadcrumb-current">
                  {step === "FORM" ? "Account Details" : "Review"}
                </span>
              </>
            )}
          </nav>
        </div>

        <div className="xls-topbar-right">
          <div className="xls-stepper">
            <div className={`xls-step ${!isReview ? "active" : "done"}`}>
              <span className="xls-step-dot">
                {isReview ? (
                  <FiCheck size={10} strokeWidth={3} />
                ) : (
                  <FiEdit3 size={10} />
                )}
              </span>
              Account Setup
            </div>
            <div className={`xls-step ${isReview ? "active" : ""}`}>
              <span className="xls-step-dot">
                <FiEye size={10} />
              </span>
              Review
            </div>
          </div>
        </div>
      </div>

      {/* ══ BODY ══ */}
      <AnimatePresence mode="wait">
        {/* ── SELECT TYPE ── */}
        {step === "SELECT_TYPE" && (
          <motion.div
            key="select"
            className="bg-base-100 xls-main"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <div className="xls-title-row">
              <div>
                <h1 className="text-5xl xls-title">Add Account</h1>
                <p className="text-lg mb-9 xls-subtitle">
                  Choose how you want to add the new account to the system.
                </p>
              </div>
            </div>

            <div
              style={{
                maxWidth: 640,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <motion.button
                className="w-full bg-base-200 hover:bg-base-300 rounded-2xl p-8 text-left transition-all border-2 border-transparent hover:border-primary group"
                onClick={() => {
                  setAccountType("EXISTING");
                  setStep("FORM");
                }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="flex items-start gap-5">
                  <div className="w-16 h-16 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center flex-shrink-0 transition-colors">
                    <FiUser className="w-8 h-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-xl mb-2">
                      Existing Employee
                    </h3>
                    <p className="text-base-content/60">
                      Select from current RTC staff members. Information will be
                      pre-filled from employee records.
                    </p>
                  </div>
                  <FiChevronRight className="w-6 h-6 text-base-content/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              </motion.button>

              <motion.button
                className="w-full bg-base-200 hover:bg-base-300 rounded-2xl p-8 text-left transition-all border-2 border-transparent hover:border-primary group"
                onClick={() => {
                  setAccountType("NEW");
                  setStep("FORM");
                }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="flex items-start gap-5">
                  <div className="w-16 h-16 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center flex-shrink-0 transition-colors">
                    <FiUserPlus className="w-8 h-8 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-xl mb-2">New Employee</h3>
                    <p className="text-base-content/60">
                      Manually enter new staff information. Use this for newly
                      hired employees.
                    </p>
                  </div>
                  <FiChevronRight className="w-6 h-6 text-base-content/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
              </motion.button>
            </div>

            <div className="xls-footer">
              <div className="xls-footer-meta" />
              <div className="xls-footer-right">
                <button className="xls-btn xls-btn-ghost" onClick={onClose}>
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── FORM ── */}
        {step === "FORM" && (
          <motion.div
            key="form"
            className="bg-base-100 xls-main"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            <div className="xls-title-row">
              <div>
                <h1 className="text-5xl xls-title">Account Details</h1>
                <p className="text-lg mb-9 xls-subtitle">
                  {accountType === "EXISTING"
                    ? "Select an employee and assign their role."
                    : "Enter the new staff member's information."}
                </p>

                {/* Account Type Badge */}
                <div className="xls-pills" style={{ marginTop: 10 }}>
                  <span className="xls-pill xls-pill-neutral">
                    <span className="xls-pill-dot" />
                    {accountType === "EXISTING"
                      ? "Existing Employee"
                      : "New Employee"}
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                maxWidth: 560,
                display: "flex",
                flexDirection: "column",
                gap: 24,
              }}
            >
              {accountType === "EXISTING" ? (
                <>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-bold text-base">
                        Select Employee
                      </span>
                      <span className="label-text-alt text-error">
                        Required
                      </span>
                    </label>
                    <select
                      className="select select-bordered w-full text-base"
                      value={form.selectedEmployeeId ?? ""}
                      onChange={(e) => {
                        if (!e.target.value || isNaN(Number(e.target.value)))
                          return;
                        handleEmployeeSelect(Number(e.target.value));
                      }}
                    >
                      <option value="">Choose an employee...</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.employeeName} — {emp.position}
                        </option>
                      ))}
                    </select>
                  </div>

                  {form.selectedEmployeeId && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                      }}
                    >
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-bold text-base">
                            Full Name
                          </span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered w-full bg-base-200 text-base"
                          value={form.name}
                          readOnly
                        />
                      </div>
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-bold text-base">
                            Email Address
                          </span>
                        </label>
                        <input
                          type="email"
                          className="input input-bordered w-full bg-base-200 text-base"
                          value={form.email}
                          readOnly
                        />
                      </div>
                    </motion.div>
                  )}
                </>
              ) : (
                <>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-bold text-base">
                        Full Name
                      </span>
                      <span className="label-text-alt text-error">
                        Required
                      </span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered w-full text-base"
                      placeholder="Juan Dela Cruz"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-bold text-base">
                        Email Address
                      </span>
                      <span className="label-text-alt text-error">
                        Required
                      </span>
                    </label>
                    <input
                      type="email"
                      className="input input-bordered w-full text-base"
                      placeholder="juan.delacruz@rtc.gov.ph"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                    <label className="label">
                      <span className="label-text-alt text-base-content/60">
                        Use official RTC email address
                      </span>
                    </label>
                  </div>
                </>
              )}

              {/* Role */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-bold text-base">
                    Account Role
                  </span>
                  <span className="label-text-alt text-error">Required</span>
                </label>
                <select
                  className="select select-bordered w-full text-base"
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as Roles })
                  }
                >
                  <option value={Roles.USER}>Staff</option>
                  <option value={Roles.ATTY}>Attorney</option>
                </select>
                <label className="label">
                  <span className="label-text-alt text-base-content/60">
                    Determines access level and permissions
                  </span>
                </label>
              </div>
            </div>

            <div className="xls-footer">
              <div className="xls-footer-meta">
                <span style={{ color: "var(--color-subtle)", fontSize: 13 }}>
                  Fields marked{" "}
                  <span style={{ color: "var(--color-error)" }}>*</span> are
                  required
                </span>
              </div>
              <div className="xls-footer-right">
                <button className="xls-btn xls-btn-ghost" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="xls-btn xls-btn-primary"
                  onClick={() => setStep("REVIEW")}
                  disabled={!canProceedToReview()}
                >
                  <FiEye size={15} />
                  Review
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── REVIEW ── */}
        {step === "REVIEW" && (
          <motion.div
            key="review"
            className="xls-main"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {/* Summary banner */}
            <div className="rv-summary">
              <div className="rv-summary-left">
                <div className="rv-summary-icon">
                  <FiCheck size={17} strokeWidth={2.5} />
                </div>
                <div>
                  <p className="rv-summary-title">Review before creating</p>
                  <p className="rv-summary-sub">
                    All fields validated. Confirm the details are correct.
                  </p>
                </div>
              </div>
              <button
                className="xls-btn xls-btn-outline"
                onClick={() => setStep("FORM")}
              >
                <FiEdit3 size={14} />
                Go Back & Edit
              </button>
            </div>

            {/* Review card */}
            <div className="rv-layout">
              <div className="rv-panel">
                <div className="rv-card">
                  <div className="rv-hero">
                    <div className="rv-hero-left">
                      <div className="rv-hero-casenum">
                        {accountType === "EXISTING"
                          ? "Existing Employee"
                          : "New Employee"}
                      </div>
                      <div className="rv-hero-name">
                        {form.name || (
                          <span style={{ opacity: 0.4, fontSize: 18 }}>
                            No name entered
                          </span>
                        )}
                      </div>
                      <div className="rv-hero-charge">{form.email}</div>
                    </div>
                    <div className="rv-hero-badges">
                      <span className="rv-badge rv-badge-court">
                        {form.role}
                      </span>
                    </div>
                  </div>

                  <div className="rv-body">
                    <div className="rv-body-main">
                      {/* Account Details */}
                      <div className="rv-section">
                        <div className="rv-section-header">
                          <FiUser size={13} />
                          <span>Account Details</span>
                        </div>
                        <div className="rv-grid rv-grid-3">
                          <div className="rv-field">
                            <div className="rv-field-label">Account Type</div>
                            <div className="rv-field-value">
                              {accountType === "EXISTING"
                                ? "Existing Employee"
                                : "New Employee"}
                            </div>
                          </div>
                          <div className="rv-field">
                            <div className="rv-field-label">Full Name</div>
                            <div className="rv-field-value">
                              {form.name || <span className="rv-empty">—</span>}
                            </div>
                          </div>
                          <div className="rv-field">
                            <div className="rv-field-label">Email Address</div>
                            <div className="rv-field-value rv-mono">
                              {form.email || (
                                <span className="rv-empty">—</span>
                              )}
                            </div>
                          </div>
                          <div className="rv-field">
                            <div className="rv-field-label">Account Role</div>
                            <div className="rv-field-value">{form.role}</div>
                          </div>
                        </div>
                      </div>

                      {/* Activation notice */}
                      <div className="rv-section">
                        <div className="rv-section-header">
                          <FiMail size={13} />
                          <span>Activation</span>
                        </div>
                        <div
                          className="alert alert-info"
                          style={{ marginTop: 8 }}
                        >
                          <FiAlertCircle className="w-5 h-5" />
                          <div>
                            <h4 className="font-bold">Activation Required</h4>
                            <p className="text-sm">
                              An activation link will be sent to{" "}
                              <strong>{form.email}</strong>. The user must
                              activate their account before logging in.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="xls-footer">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  className="xls-btn xls-btn-ghost"
                  onClick={() => setStep("FORM")}
                >
                  <FiArrowLeft size={14} />
                  Back to Edit
                </button>
              </div>
              <button
                className="xls-btn xls-btn-success"
                style={{
                  height: 50,
                  paddingLeft: 30,
                  paddingRight: 30,
                  fontSize: 16,
                }}
                onClick={handleCreate}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="xls-spinner" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FiSave size={17} />
                    Confirm & Create
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AddAccountDrawer;
