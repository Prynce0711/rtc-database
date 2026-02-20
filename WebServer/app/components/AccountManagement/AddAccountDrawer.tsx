"use client";

import { User } from "@/app/generated/prisma/browser";
import { Employee } from "@/app/generated/prisma/client";
import Roles from "@/app/lib/Roles";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  FiAlertCircle,
  FiCheck,
  FiChevronRight,
  FiFileText,
  FiMail,
  FiUser,
  FiUserPlus,
  FiX,
} from "react-icons/fi";
import { getEmployees } from "../Employee/EmployeeActions";
import { usePopup } from "../Popup/PopupProvider";
import { createAccount } from "./AccountActions";
import { NewUserSchema } from "./schema";

type AccountType = "EXISTING" | "NEW" | null;

const AddAccountDrawer = ({
  isOpen,
  onClose,
  onCreate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (user: User) => void;
}) => {
  const statusPopup = usePopup();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [step, setStep] = useState<"SELECT_TYPE" | "FORM" | "REVIEW">(
    "SELECT_TYPE",
  );
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<
    NewUserSchema & { selectedEmployeeId?: number }
  >({
    name: "",
    email: "",
    role: Roles.USER,
  });

  const resetForm = () => {
    setForm({
      name: "",
      email: "",
      role: Roles.USER,
    });
    setAccountType(null);
    setStep("SELECT_TYPE");
  };

  useEffect(() => {
    async function fetchEmployees() {
      try {
        const result = await getEmployees();
        if (result.success) {
          setEmployees(result.result);
        } else {
          statusPopup.showError("Failed to fetch employees");
        }
      } catch (error) {
        statusPopup.showError("An error occurred while fetching employees");
      }
    }

    fetchEmployees();
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
    setLoading(true);
    statusPopup.showLoading("Creating account...");

    const result = await createAccount(form);

    setLoading(false);

    if (!result.success) {
      statusPopup.showError(result.error || "Failed to create account");
      return;
    }

    statusPopup.showSuccess("Account Created. Activation link sent.");
    onCreate(result.result);
    onClose();
  };

  const handleTypeSelect = (type: AccountType) => {
    setAccountType(type);
    setStep("FORM");
  };

  const canProceedToReview = () => {
    if (accountType === "EXISTING") {
      return form.selectedEmployeeId && form.role;
    }
    return form.name && form.email && form.role;
  };

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Drawer - LARGER WIDTH */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed right-0 top-0 h-full w-full md:w-[600px] lg:w-[700px] bg-base-100 shadow-2xl z-50 overflow-y-auto border-l border-base-300"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Header (styled like design) */}
            <div className="sticky top-0 z-10">
              <div className="w-full bg-gradient-to-r from-blue-600 to-cyan-400 text-white p-6 lg:p-8 flex items-center justify-between shadow-md">
                <div>
                  <h2 className="text-3xl font-bold">Add Account</h2>
                  <p className="text-sm mt-1 opacity-90">
                    Fill in employee details
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="btn btn-ghost btn-sm btn-circle text-white/90"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 lg:p-8">
              {/* Top hero: avatar + brief */}
              <div className="mb-6 flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0">
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-blue-600">
                    <FiUserPlus className="w-6 h-6" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">New Employee</h3>
                  <p className="text-sm text-base-content/60 mt-1">
                    Unassigned Position
                  </p>
                </div>
              </div>

              {/* Main rounded content card to emulate design */}
              <div className="rounded-2xl bg-base-100 shadow-lg p-6">
                {/* STEP 1: SELECT ACCOUNT TYPE */}
                {step === "SELECT_TYPE" && (
                  <motion.div
                    className="space-y-5"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <div className="mb-6">
                      <h3 className="text-xl font-bold mb-2">
                        Select Account Type
                      </h3>
                      <p className="text-base-content/60">
                        Choose how you want to add the new account to the system
                      </p>
                    </div>

                  {accountType === "EXISTING" ? (
                    <>
                      {/* Employee Selection */}
                      <div>
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
                          value={form.selectedEmployeeId}
                          onChange={(e) => {
                            if (isNaN(Number(e.target.value))) {
                              statusPopup.showError(
                                "Invalid employee selected",
                              );
                              return;
                            }
                            const selectedId = Number(e.target.value);
                            handleEmployeeSelect(selectedId);
                          }}
                        >
                          <option value="">Choose an employee...</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.employeeName} - {emp.position}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Display Selected Employee Info (Read-only) */}
                      {form.selectedEmployeeId && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="space-y-4"
                        >
                          <div>
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

                          <div>
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
                      {/* Manual Entry for New Employee */}
                      <div>
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

                      <div>
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

                  {/* Role Selection (Common for both types) */}
                  <div>
                    <label className="label">
                      <span className="label-text font-bold text-base">
                        Account Role
                      </span>
                      <span className="label-text-alt text-error">
                        Required
                      </span>
                    </label>
                    <select
                      className="select select-bordered w-full text-base"
                      value={form.role}
                      onChange={(e) =>
                        setForm({ ...form, role: e.target.value as Roles })
                      }
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
                            Select from current RTC staff members. Information
                            will be pre-filled from employee records.
                          </p>
                        </div>
                        <FiChevronRight className="w-6 h-6 text-base-content/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </div>
                    </motion.button>

                    <motion.button
                      className="w-full bg-base-200 hover:bg-base-300 rounded-2xl p-8 text-left transition-all border-2 border-transparent hover:border-primary group"
                      onClick={() => handleTypeSelect("NEW")}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className="flex items-start gap-5">
                        <div className="w-16 h-16 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center flex-shrink-0 transition-colors">
                          <FiUserPlus className="w-8 h-8 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-xl mb-2">
                            New Employee
                          </h3>
                          <p className="text-base-content/60">
                            Manually enter new staff information. Use this for
                            newly hired employees.
                          </p>
                        </div>
                        <FiChevronRight className="w-6 h-6 text-base-content/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </div>
                    </motion.button>
                  </motion.div>
                )}

                {/* STEP 2: FORM */}
                {step === "FORM" && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    {/* Account Type Badge */}
                    <div className="flex items-center gap-3">
                      <div className="badge badge-lg badge-primary gap-2 px-4 py-3">
                        {accountType === "EXISTING" ? (
                          <FiUser className="w-4 h-4" />
                        ) : (
                          <FiUserPlus className="w-4 h-4" />
                        )}
                        <span className="font-semibold">
                          {accountType === "EXISTING"
                            ? "Existing Employee"
                            : "New Employee"}
                        </span>
                      </div>
                    </div>

                    {accountType === "EXISTING" ? (
                      <>
                        {/* Employee Selection */}
                        <div>
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
                            value={form.selectedEmployeeId}
                            onChange={(e) =>
                              handleEmployeeSelect(e.target.value)
                            }
                          >
                            <option value="">Choose an employee...</option>
                            {EXISTING_EMPLOYEES.map((emp) => (
                              <option key={emp.id} value={emp.id}>
                                {emp.name} - {emp.position}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Display Selected Employee Info (Read-only) */}
                        {form.selectedEmployeeId && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="space-y-4"
                          >
                            <div>
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

                            <div>
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
                        {/* Manual Entry for New Employee */}
                        <div>
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

                        <div>
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

                    {/* Role Selection (Common for both types) */}
                    <div>
                      <label className="label">
                        <span className="label-text font-bold text-base">
                          Account Role
                        </span>
                        <span className="label-text-alt text-error">
                          Required
                        </span>
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

                    {/* Actions */}
                    <div className="flex gap-3 pt-6">
                      <button
                        className="btn btn-ghost flex-1"
                        onClick={() => {
                          resetForm();
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary flex-1"
                        onClick={() => setStep("REVIEW")}
                        disabled={!canProceedToReview()}
                      >
                        Review
                        <FiChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* STEP 3: REVIEW */}
                {step === "REVIEW" && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="card bg-base-200 shadow-sm">
                      <div className="card-body p-6">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                            <FiCheck className="w-6 h-6 text-success" />
                          </div>
                          <div>
                            <h3 className="font-bold text-xl">
                              Review Account Details
                            </h3>
                            <p className="text-sm text-base-content/60">
                              Please verify all information before creating
                            </p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-start gap-4 p-4 rounded-xl bg-base-100">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              {accountType === "EXISTING" ? (
                                <FiUser className="w-5 h-5 text-primary" />
                              ) : (
                                <FiUserPlus className="w-5 h-5 text-primary" />
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-xs text-base-content/60 mb-1 font-semibold">
                                ACCOUNT TYPE
                              </p>
                              <p className="font-bold text-base">
                                {accountType === "EXISTING"
                                  ? "Existing Employee"
                                  : "New Employee"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-4 p-4 rounded-xl bg-base-100">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <FiUser className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs text-base-content/60 mb-1 font-semibold">
                                FULL NAME
                              </p>
                              <p className="font-bold text-base">{form.name}</p>
                            </div>
                          </div>

                          <div className="flex items-start gap-4 p-4 rounded-xl bg-base-100">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <FiMail className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs text-base-content/60 mb-1 font-semibold">
                                EMAIL ADDRESS
                              </p>
                              <p className="font-bold text-base">
                                {form.email}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-4 p-4 rounded-xl bg-base-100">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <FiFileText className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs text-base-content/60 mb-1 font-semibold">
                                ACCOUNT ROLE
                              </p>
                              <p className="font-bold text-base">{form.role}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="alert alert-info">
                      <FiAlertCircle className="w-5 h-5" />
                      <div>
                        <h4 className="font-bold">Activation Required</h4>
                        <p className="text-sm">
                          An activation link will be sent to{" "}
                          <strong>{form.email}</strong>. The user must activate
                          their account before logging in.
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-6">
                      <button
                        className="btn btn-ghost flex-1"
                        onClick={() => setStep("FORM")}
                        disabled={loading}
                      >
                        Back
                      </button>
                      <button
                        className="btn btn-primary flex-1"
                        onClick={handleCreate}
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <span className="loading loading-spinner loading-sm"></span>
                            Creating...
                          </>
                        ) : (
                          <>
                            <FiCheck className="w-4 h-4" />
                            Confirm & Create
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Sticky Footer (UI only) */}
            <div className="sticky bottom-0 bg-base-100 border-t border-base-300 p-4 z-20">
              <div className="max-w-full md:max-w-[640px] lg:max-w-[700px] mx-auto flex justify-end gap-3">
                <button className="btn btn-ghost" onClick={onClose}>
                  Close
                </button>
                <button
                  className="btn btn-primary rounded-full"
                  onClick={() => {
                    if (step !== "REVIEW") {
                      setStep("REVIEW");
                      return;
                    }
                    handleCreate();
                  }}
                  disabled={step !== "REVIEW" ? !canProceedToReview() : loading}
                >
                  {step !== "REVIEW"
                    ? "Create"
                    : loading
                      ? "Creating..."
                      : "Create"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AddAccountDrawer;
