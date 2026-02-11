"use client";

import { User } from "@/app/generated/prisma/browser";
import Roles from "@/app/lib/Roles";
import { useState } from "react";
import { usePopup } from "../Popup/PopupProvider";
import { createAccount } from "./AccountActions";
import { NewUserSchema } from "./schema";

const AddAccountModal = ({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (newUser: User) => void;
}) => {
  const statusPopup = usePopup();

  const [newAccount, setNewAccount] = useState({
    name: "",
    email: "",
    role: Roles.USER,
    password: "",
  });

  async function requestCreate() {
    const payload: NewUserSchema = {
      name: newAccount.name,
      email: newAccount.email,
      role: newAccount.role as any,
    } as NewUserSchema;

    const result = await createAccount(payload);
    if (!result.success) {
      statusPopup.showError("Error creating account: " + result.error, "error");
      return;
    }
    onCreate(result.result);
    statusPopup.showSuccess("Account created successfully");
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-4xl p-0">
        <div className="bg-gradient-to-r from-primary to-info text-primary-content rounded-t-2xl px-6 py-4 relative">
          <button
            className="btn btn-sm btn-ghost absolute right-3 top-3 text-primary-content"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
          <h3 className="text-xl md:text-2xl font-semibold">Add New Account</h3>
          <p className="text-sm md:text-base opacity-90">New Account</p>
        </div>

        <div className="px-6 py-6">
          <div className="bg-base-100 rounded-xl border border-base-200 p-5 md:p-6">
            <h4 className="text-base md:text-lg font-semibold mb-4">
              Account Information
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-base-content/70">
                  Full Name
                </label>
                <input
                  className="input input-bordered w-full"
                  placeholder="Full Name"
                  value={newAccount.name}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-base-content/70">
                  Email
                </label>
                <input
                  className="input input-bordered w-full"
                  placeholder="Email"
                  value={newAccount.email}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, email: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-base-content/70">
                  Role
                </label>
                <select
                  className="select select-bordered w-full"
                  value={newAccount.role}
                  onChange={(e) =>
                    setNewAccount({
                      ...newAccount,
                      role: e.target.value as Roles,
                    })
                  }
                >
                  <option>Admin</option>
                  <option>Staff</option>
                  <option>Atty</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-base-content/70">
                  Password
                </label>
                <input
                  className="input input-bordered w-full"
                  type="password"
                  placeholder="Password"
                  value={newAccount.password}
                  onChange={(e) =>
                    setNewAccount({ ...newAccount, password: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <div className="modal-action px-6 pb-6">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>

          <button className="btn btn-primary" onClick={requestCreate}>
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddAccountModal;
