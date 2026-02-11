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
  const [newAccount, setNewAccount] = useState<NewUserSchema>({
    name: "",
    email: "",
    role: Roles.USER,
  });

  async function requestCreate(newUser: NewUserSchema) {
    const result = await createAccount(newUser);
    if (!result.success) {
      statusPopup.showError("Error creating account: " + result.error, "error");
      return;
    }
    onCreate(result.result);
    statusPopup.showSuccess("Account created successfully");
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">Add Account</h3>

        <div className="space-y-3 mt-4">
          <input
            className="input input-bordered w-full"
            placeholder="Full Name"
            value={newAccount.name}
            onChange={(e) =>
              setNewAccount({ ...newAccount, name: e.target.value })
            }
          />

          <input
            className="input input-bordered w-full"
            placeholder="Email"
            value={newAccount.email}
            onChange={(e) =>
              setNewAccount({ ...newAccount, email: e.target.value })
            }
          />

          <select
            className="select select-bordered w-full"
            value={newAccount.role}
            onChange={(e) =>
              setNewAccount({ ...newAccount, role: e.target.value as Roles })
            }
          >
            <option value={Roles.ADMIN}>Admin</option>
            <option value={Roles.ATTY}>Atty</option>
            <option value={Roles.USER}>User</option>
          </select>
        </div>

        <div className="modal-action">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>

          <button
            className="btn btn-primary"
            onClick={() => requestCreate(newAccount)}
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddAccountModal;
