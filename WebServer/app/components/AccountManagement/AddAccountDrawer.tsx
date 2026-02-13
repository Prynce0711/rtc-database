"use client";

import { Status } from "@/app/generated/prisma/enums";
import Roles from "@/app/lib/Roles";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import {
  FiCheck,
  FiChevronRight,
  FiFileText,
  FiMail,
  FiUser,
  FiUserPlus,
  FiX,
} from "react-icons/fi";
import { usePopup } from "../Popup/PopupProvider";

export type MockUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: Status | "PENDING";
  createdAt: Date;
  updatedAt: Date;
};

// Mock existing employees data
const EXISTING_EMPLOYEES = [
  {
    id: "emp-1",
    name: "Juan Dela Cruz",
    email: "juan.delacruz@rtc.gov.ph",
    position: "Legal Assistant",
  },
  {
    id: "emp-2",
    name: "Maria Santos",
    email: "maria.santos@rtc.gov.ph",
    position: "Court Stenographer",
  },
  {
    id: "emp-3",
    name: "Jose Reyes",
    email: "jose.reyes@rtc.gov.ph",
    position: "Process Server",
  },
  {
    id: "emp-4",
    name: "Ana Garcia",
    email: "ana.garcia@rtc.gov.ph",
    position: "Legal Researcher",
  },
  {
    id: "emp-5",
    name: "Pedro Ramos",
    email: "pedro.ramos@rtc.gov.ph",
    position: "Court Interpreter",
  },
];

type AccountType = "EXISTING" | "NEW" | null;

const AddAccountDrawer = ({
  isOpen,
  onClose,
  onCreate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (user: MockUser) => void;
}) => {
  const popup = usePopup();
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [step, setStep] = useState<"SELECT_TYPE" | "FORM" | "REVIEW">(
    "SELECT_TYPE",
  );
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: Roles.USER,
    selectedEmployeeId: "",
  });

  const resetForm = () => {
    setForm({
      name: "",
      email: "",
      role: Roles.USER,
      selectedEmployeeId: "",
    });
    setAccountType(null);
    setStep("SELECT_TYPE");
  };

  const handleEmployeeSelect = (employeeId: string) => {
    const employee = EXISTING_EMPLOYEES.find((e) => e.id === employeeId);
    if (employee) {
      setForm({
        ...form,
        selectedEmployeeId: employeeId,
        name: employee.name,
        email: employee.email,
      });
    }
  };

  const handleCreate = async () => {
    setLoading(true);

    await new Promise((r) => setTimeout(r, 1500));

    const newUser: MockUser = {
      id: crypto.randomUUID(),
      name: form.name,
      email: form.email,
      role: form.role,
      status: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    popup.showSuccess("Account created successfully! Activation link sent.");
    onCreate(newUser);
    resetForm();
    onClose();
    setLoading(false);
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

      {/* Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed right-0 top-0 h-full w-full md:w-[500px] bg-base-100 shadow-2xl z-50 overflow-y-auto"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className="sticky top-0 bg-base-100 border-b border-base-300 p-6 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold">Add Account</h2>
              <button
                onClick={onClose}
                className="btn btn-ghost btn-sm btn-circle"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {/* STEP 1: SELECT ACCOUNT TYPE */}
              {step === "SELECT_TYPE" && (
                <motion.div
                  className="space-y-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <p className="text-sm text-base-content/60 mb-6">
                    Choose how you want to add the account
                  </p>

                  <motion.button
                    className="w-full bg-base-200 hover:bg-base-300 rounded-xl p-6 text-left transition-all border-2 border-transparent hover:border-primary"
                    onClick={() => handleTypeSelect("EXISTING")}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FiUser className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1">
                          Existing Employee
                        </h3>
                        <p className="text-sm text-base-content/60">
                          Select from current RTC staff members
                        </p>
                      </div>
                      <FiChevronRight className="w-5 h-5 text-base-content/40" />
                    </div>
                  </motion.button>

                  <motion.button
                    className="w-full bg-base-200 hover:bg-base-300 rounded-xl p-6 text-left transition-all border-2 border-transparent hover:border-primary"
                    onClick={() => handleTypeSelect("NEW")}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FiUserPlus className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1">
                          New Employee
                        </h3>
                        <p className="text-sm text-base-content/60">
                          Manually enter new staff information
                        </p>
                      </div>
                      <FiChevronRight className="w-5 h-5 text-base-content/40" />
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
                  className="space-y-5"
                >
                  {/* Account Type Badge */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="badge badge-lg badge-primary gap-2">
                      {accountType === "EXISTING" ? (
                        <FiUser className="w-4 h-4" />
                      ) : (
                        <FiUserPlus className="w-4 h-4" />
                      )}
                      {accountType === "EXISTING"
                        ? "Existing Employee"
                        : "New Employee"}
                    </div>
                  </div>

                  {accountType === "EXISTING" ? (
                    <>
                      {/* Employee Selection */}
                      <div>
                        <label className="label">
                          <span className="label-text font-semibold">
                            Select Employee
                          </span>
                        </label>
                        <select
                          className="select select-bordered w-full"
                          value={form.selectedEmployeeId}
                          onChange={(e) => handleEmployeeSelect(e.target.value)}
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
                          className="space-y-3"
                        >
                          <div>
                            <label className="label">
                              <span className="label-text font-semibold">
                                Full Name
                              </span>
                            </label>
                            <input
                              type="text"
                              className="input input-bordered w-full bg-base-200"
                              value={form.name}
                              readOnly
                            />
                          </div>

                          <div>
                            <label className="label">
                              <span className="label-text font-semibold">
                                Email Address
                              </span>
                            </label>
                            <input
                              type="email"
                              className="input input-bordered w-full bg-base-200"
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
                          <span className="label-text font-semibold">
                            Full Name
                          </span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered w-full"
                          placeholder="Enter full name"
                          value={form.name}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                        />
                      </div>

                      <div>
                        <label className="label">
                          <span className="label-text font-semibold">
                            Email Address
                          </span>
                        </label>
                        <input
                          type="email"
                          className="input input-bordered w-full"
                          placeholder="email@rtc.gov.ph"
                          value={form.email}
                          onChange={(e) =>
                            setForm({ ...form, email: e.target.value })
                          }
                        />
                      </div>
                    </>
                  )}

                  {/* Role Selection (Common for both types) */}
                  <div>
                    <label className="label">
                      <span className="label-text font-semibold">
                        Account Role
                      </span>
                    </label>
                    <select
                      className="select select-bordered w-full"
                      value={form.role}
                      onChange={(e) =>
                        setForm({ ...form, role: e.target.value as Roles })
                      }
                    >
                      <option value={Roles.USER}>Staff</option>
                      <option value={Roles.ATTY}>Attorney</option>
                    </select>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4">
                    <button
                      className="btn btn-ghost flex-1"
                      onClick={() => {
                        resetForm();
                      }}
                    >
                      Back
                    </button>
                    <button
                      className="btn btn-primary flex-1"
                      onClick={() => setStep("REVIEW")}
                      disabled={!canProceedToReview()}
                    >
                      Review
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
                  className="space-y-5"
                >
                  <div className="card bg-base-200">
                    <div className="card-body p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <FiCheck className="w-5 h-5 text-primary" />
                        </div>
                        <h3 className="font-semibold text-lg">
                          Review Account Details
                        </h3>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-base-100">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            {accountType === "EXISTING" ? (
                              <FiUser className="w-4 h-4 text-primary" />
                            ) : (
                              <FiUserPlus className="w-4 h-4 text-primary" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-base-content/60 mb-1">
                              Account Type
                            </p>
                            <p className="font-semibold">
                              {accountType === "EXISTING"
                                ? "Existing Employee"
                                : "New Employee"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg bg-base-100">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <FiUser className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-base-content/60 mb-1">
                              Full Name
                            </p>
                            <p className="font-semibold">{form.name}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg bg-base-100">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <FiMail className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-base-content/60 mb-1">
                              Email Address
                            </p>
                            <p className="font-semibold">{form.email}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg bg-base-100">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <FiFileText className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-base-content/60 mb-1">
                              Role
                            </p>
                            <p className="font-semibold">{form.role}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="alert alert-warning">
                    <FiMail className="w-5 h-5" />
                    <div>
                      <p className="text-sm font-medium">
                        An activation link will be sent to{" "}
                        <strong>{form.email}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4">
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
                        <span className="loading loading-spinner loading-sm"></span>
                      ) : (
                        "Confirm & Create"
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AddAccountDrawer;
