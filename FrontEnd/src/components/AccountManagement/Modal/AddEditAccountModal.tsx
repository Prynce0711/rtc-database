import React from "react";

import type { AccountFormData } from "../Forms/AccountForm.types";

interface AddEditAccountModalProps {
  isOpen: boolean;
  isEdit: boolean;
  formData: AccountFormData;
  formErrors: Record<string, string>;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onChange: (data: Partial<AccountFormData>) => void;
}

const AddEditAccountModal: React.FC<AddEditAccountModalProps> = ({
  isOpen,
  isEdit,
  formData,
  formErrors,
  onClose,
  onSubmit,
  onChange,
}) => {
  if (!isOpen) return null;

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-2xl">
        <h3 className="font-bold text-lg mb-4">
          {isEdit ? "Edit Account" : "Add New Account"}
        </h3>
        <form onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-4">
            {/* Name */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Name *</span>
              </label>
              <input
                type="text"
                className={`input input-bordered ${formErrors.name ? "input-error" : ""}`}
                value={formData.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder="Enter full name"
              />
              {formErrors.name && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {formErrors.name}
                  </span>
                </label>
              )}
            </div>

            {/* Email */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Email *</span>
              </label>
              <input
                type="email"
                className={`input input-bordered ${formErrors.email ? "input-error" : ""}`}
                value={formData.email}
                onChange={(e) => onChange({ email: e.target.value })}
                placeholder="email@example.com"
                disabled={isEdit}
              />
              {formErrors.email && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {formErrors.email}
                  </span>
                </label>
              )}
            </div>

            {/* Password */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">
                  Password {!isEdit && "*"}
                  {isEdit && " (leave blank to keep current)"}
                </span>
              </label>
              <input
                type="password"
                className={`input input-bordered ${formErrors.password ? "input-error" : ""}`}
                value={formData.password || ""}
                onChange={(e) => onChange({ password: e.target.value })}
                placeholder={
                  isEdit
                    ? "Leave blank to keep current"
                    : "Minimum 6 characters"
                }
              />
              {formErrors.password && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {formErrors.password}
                  </span>
                </label>
              )}
            </div>

            {/* Role */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Role *</span>
              </label>
              <select
                className={`select select-bordered ${formErrors.role ? "select-error" : ""}`}
                value={formData.role}
                onChange={(e) =>
                  onChange({
                    role: e.target.value as AccountFormData["role"],
                  })
                }
              >
                <option value="STAFF">Staff</option>
                <option value="ADMIN">Admin</option>
                <option value="SUPERADMIN">Super Admin</option>
              </select>
              {formErrors.role && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {formErrors.role}
                  </span>
                </label>
              )}
            </div>

            {/* Banned Status */}
            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-4">
                <span className="label-text">Ban Account</span>
                <input
                  type="checkbox"
                  className="checkbox checkbox-error"
                  checked={formData.banned}
                  onChange={(e) => onChange({ banned: e.target.checked })}
                />
              </label>
            </div>

            {/* Ban Reason (shown if banned) */}
            {formData.banned && (
              <>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Ban Reason *</span>
                  </label>
                  <textarea
                    className={`textarea textarea-bordered ${formErrors.banReason ? "textarea-error" : ""}`}
                    value={formData.banReason || ""}
                    onChange={(e) => onChange({ banReason: e.target.value })}
                    placeholder="Enter reason for banning this account"
                    rows={3}
                  />
                  {formErrors.banReason && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {formErrors.banReason}
                      </span>
                    </label>
                  )}
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Ban Expiry Date</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="input input-bordered"
                    value={
                      formData.banExpires
                        ? new Date(formData.banExpires)
                            .toISOString()
                            .slice(0, 16)
                        : ""
                    }
                    onChange={(e) =>
                      onChange({
                        banExpires: e.target.value
                          ? new Date(e.target.value)
                          : undefined,
                      })
                    }
                  />
                  <label className="label">
                    <span className="label-text-alt">
                      Leave blank for permanent ban
                    </span>
                  </label>
                </div>
              </>
            )}
          </div>

          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {isEdit ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
};

export default AddEditAccountModal;
