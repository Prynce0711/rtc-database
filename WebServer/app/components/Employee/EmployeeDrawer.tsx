"use client";

import type { Employee } from "@/app/generated/prisma/browser";
import { AnimatePresence, motion } from "framer-motion";
import React from "react";
import { FiBriefcase, FiHeart, FiUser, FiX } from "react-icons/fi";
import FormField from "../Case/FormField";

interface Props {
  showModal: boolean;
  isEdit: boolean;
  form: Partial<Employee>;
  errors: Record<string, string>;
  bloodTypeMap: Record<string, string>;
  setForm: (form: Partial<Employee>) => void;
  setShowModal: (val: boolean) => void;
  handleSave: (e: React.FormEvent) => void;
}

const EmployeeDrawer: React.FC<Props> = ({
  showModal,
  isEdit,
  form,
  errors,
  bloodTypeMap,
  setForm,
  setShowModal,
  handleSave,
}) => {
  const formRef = React.useRef<HTMLFormElement | null>(null);

  const initials = React.useMemo(() => {
    const name = (form.employeeName || "").trim();
    if (!name) return "+";
    const parts = name.split(" ").filter(Boolean);
    return (
      (parts[0][0] || "").toUpperCase() + (parts[1]?.[0] || "").toUpperCase()
    );
  }, [form.employeeName]);

  if (!showModal) return null;

  return (
    <>
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed right-0 top-0 h-full w-full md:w-[720px] lg:w-[900px] bg-base-100 shadow-2xl z-50 overflow-hidden border-l border-base-300 rounded-l-xl flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className="sticky top-0 z-20 bg-gradient-to-r from-blue-600 to-sky-400 text-white p-6 rounded-tl-xl flex items-start justify-between gap-4 shadow-md">
              <div>
                <h2 className="text-2xl md:text-3xl font-semibold leading-tight">
                  {isEdit ? "Edit Employee" : "Add Employee"}
                </h2>
                <p className="text-sm text-white/90 mt-1">
                  Fill in employee details
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="btn btn-ghost btn-sm btn-circle bg-white/10 hover:bg-white/20 text-white"
                aria-label="Close drawer"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Content (scrollable) */}
            <div className="flex-1 overflow-auto p-8">
              <form
                ref={formRef}
                onSubmit={handleSave}
                className="max-w-[1100px] mx-auto space-y-6"
              >
                <div className="flex items-center gap-4 -mt-6">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center text-xl font-semibold shadow-md">
                    {initials}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      {form.employeeName || "New Employee"}
                    </h3>
                    <p className="text-sm text-base-content/60">
                      {form.position || "Unassigned Position"}
                    </p>
                  </div>
                </div>

                {/* Personal Info */}
                <div className="card rounded-2xl shadow-sm">
                  <div className="card-body p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-md bg-sky-100 text-sky-600">
                        <FiUser />
                      </div>
                      <div>
                        <h4 className="font-semibold">Personal Information</h4>
                        <p className="text-xs text-base-content/60">
                          Name, employee number and basic details
                        </p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-5">
                      {/* Employee Name */}
                      <FormField
                        label={"Employee Name *"}
                        error={errors.employeeName}
                      >
                        <input
                          className={`input input-bordered w-full ${errors.employeeName && "input-error"}`}
                          value={form.employeeName || ""}
                          onChange={(e) =>
                            setForm({ ...form, employeeName: e.target.value })
                          }
                        />
                      </FormField>

                      {/* Employee Number */}
                      <FormField
                        label={"Employee Number *"}
                        error={errors.employeeNumber}
                      >
                        <input
                          className="input input-bordered w-full"
                          value={form.employeeNumber || ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              employeeNumber: e.target.value.replace(/\D/g, ""),
                            })
                          }
                        />
                      </FormField>

                      {/* Position */}
                      <FormField label={"Position *"} error={errors.position}>
                        <input
                          className={`input input-bordered w-full ${errors.position && "input-error"}`}
                          value={form.position || ""}
                          onChange={(e) =>
                            setForm({ ...form, position: e.target.value })
                          }
                        />
                      </FormField>

                      {/* Branch */}
                      <FormField
                        label={"Branch / Station *"}
                        error={errors.branch}
                      >
                        <input
                          className={`input input-bordered w-full ${errors.branch && "input-error"}`}
                          value={form.branch || ""}
                          onChange={(e) =>
                            setForm({ ...form, branch: e.target.value })
                          }
                        />
                      </FormField>

                      {/* Birthday */}
                      <FormField label={"Birthday *"} error={errors.birthDate}>
                        <input
                          type="date"
                          className={`input input-bordered w-full ${errors.birthDate && "input-error"}`}
                          value={
                            form.birthDate
                              ? new Date(form.birthDate)
                                  .toISOString()
                                  .split("T")[0]
                              : ""
                          }
                          onChange={(e) =>
                            setForm({
                              ...form,
                              birthDate: new Date(e.target.value + "T00:00:00"),
                            })
                          }
                        />
                      </FormField>

                      {/* Contact Person */}
                      <FormField label={"Contact Person *"}>
                        <input
                          className="input input-bordered w-full"
                          value={form.contactPerson || ""}
                          onChange={(e) =>
                            setForm({ ...form, contactPerson: e.target.value })
                          }
                        />
                      </FormField>

                      {/* Contact Number */}
                      <FormField
                        label={"Contact Number"}
                        error={errors.contactNumber}
                      >
                        <input
                          className="input input-bordered w-full"
                          value={form.contactNumber || ""}
                          onChange={(e) => {
                            let numbers = e.target.value
                              .replace(/\D/g, "")
                              .slice(0, 11);
                            if (numbers.length > 4 && numbers.length <= 8)
                              numbers = numbers.replace(
                                /(\d{4})(\d+)/,
                                "$1-$2",
                              );
                            if (numbers.length > 8)
                              numbers = numbers.replace(
                                /(\d{4})(\d{4})(\d+)/,
                                "$1-$2-$3",
                              );
                            setForm({ ...form, contactNumber: numbers });
                          }}
                        />
                      </FormField>

                      {/* Email */}
                      <div className="md:col-span-2">
                        <FormField label={"Email"} error={errors.email}>
                          <input
                            className={`input input-bordered w-full ${errors.email && "input-error"}`}
                            value={form.email || ""}
                            onChange={(e) =>
                              setForm({ ...form, email: e.target.value })
                            }
                          />
                        </FormField>
                      </div>
                    </div>
                  </div>
                </div>

                {/* IDs & Benefits */}
                <div className="card rounded-2xl shadow-sm">
                  <div className="card-body p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-md bg-amber-100 text-amber-600">
                        <FiBriefcase />
                      </div>
                      <div>
                        <h4 className="font-semibold">IDs & Benefits</h4>
                        <p className="text-xs text-base-content/60">
                          TIN, GSIS and other government IDs
                        </p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-5">
                      <FormField label={"TIN"}>
                        <input
                          className="input input-bordered w-full"
                          value={form.tinNumber || ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              tinNumber: e.target.value.replace(/\D/g, ""),
                            })
                          }
                        />
                      </FormField>
                      <FormField label={"GSIS"}>
                        <input
                          className="input input-bordered w-full"
                          value={form.gsisNumber || ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              gsisNumber: e.target.value.replace(/\D/g, ""),
                            })
                          }
                        />
                      </FormField>

                      <FormField label={"PhilHealth"}>
                        <input
                          className="input input-bordered w-full"
                          value={form.philHealthNumber || ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              philHealthNumber: e.target.value.replace(
                                /\D/g,
                                "",
                              ),
                            })
                          }
                        />
                      </FormField>
                      <FormField label={"Pag-IBIG"}>
                        <input
                          className="input input-bordered w-full"
                          value={form.pagIbigNumber || ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              pagIbigNumber: e.target.value.replace(/\D/g, ""),
                            })
                          }
                        />
                      </FormField>
                    </div>
                  </div>
                </div>

                {/* Measurements & Health */}
                <div className="card rounded-2xl shadow-sm">
                  <div className="card-body p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-md bg-pink-100 text-pink-600">
                        <FiHeart />
                      </div>
                      <div>
                        <h4 className="font-semibold">Measurements & Health</h4>
                        <p className="text-xs text-base-content/60">
                          Physical details and allergies
                        </p>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-5">
                      <FormField label={"Height"}>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.01"
                            className="input input-bordered w-full"
                            value={form.height ?? ""}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                height: e.target.value
                                  ? Number(e.target.value)
                                  : undefined,
                              })
                            }
                          />
                          <select className="select select-bordered">
                            <option>cm</option>
                            <option>ft</option>
                          </select>
                        </div>
                      </FormField>

                      <FormField label={"Weight"}>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.01"
                            className="input input-bordered w-full"
                            value={form.weight ?? ""}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                weight: e.target.value
                                  ? Number(e.target.value)
                                  : undefined,
                              })
                            }
                          />
                          <select className="select select-bordered">
                            <option>kg</option>
                            <option>lbs</option>
                          </select>
                        </div>
                      </FormField>

                      <FormField label={"Blood Type"}>
                        <select
                          className="select select-bordered w-full"
                          value={(form as any).bloodType || ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              bloodType: e.target.value as any,
                            })
                          }
                        >
                          <option value="">Select blood type</option>
                          {Object.entries(bloodTypeMap).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </FormField>

                      <div className="md:col-span-2">
                        <FormField label={"Allergies"}>
                          <textarea
                            className="textarea textarea-bordered w-full"
                            rows={3}
                            value={(form as any).allergies || ""}
                            onChange={(e) =>
                              setForm({ ...form, allergies: e.target.value })
                            }
                          />
                        </FormField>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            {/* Footer (sticky) */}
            <div className="sticky bottom-0 z-30 bg-base-100 border-t border-base-300 p-4 flex justify-end gap-3">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary px-8"
                onClick={() =>
                  (formRef.current as HTMLFormElement)?.requestSubmit()
                }
              >
                {isEdit ? "Update" : "Create"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default EmployeeDrawer;
