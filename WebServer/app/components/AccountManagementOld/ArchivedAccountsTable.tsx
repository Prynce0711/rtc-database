"use client";

import { User } from "@/app/generated/prisma/browser";
import { formatDate } from "@/app/lib/utils";
import { useState } from "react";
import { usePopup } from "../Popup/PopupProvider";
import { unbanAccount } from "./AccountActions";

const ArchivedAccountsTable = ({
  allUsers,
  pageSize,
  onRestore,
}: {
  allUsers: User[];
  pageSize: number;
  onRestore?: (ids: string[]) => void;
}) => {
  const [archivePage, setArchivePage] = useState(1);
  const popup = usePopup();
  const archivedUsers = allUsers.filter((u) => u.status === "INACTIVE");

  const paginatedArchivedUsers = archivedUsers.slice(
    (archivePage - 1) * pageSize,
    archivePage * pageSize,
  );
  const archiveTotalPages = Math.ceil(archivedUsers.length / pageSize);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Deactivated Accounts</h3>
        <span className="text-sm text-base-content/60">
          {archivedUsers.length} archived
        </span>
      </div>

      <div className="overflow-x-auto bg-base-100 shadow rounded-lg">
        <table className="table table-zebra text-base md:text-lg">
          <thead>
            <tr>
              <th className="font-medium">Name</th>
              <th className="font-medium">Email</th>
              <th className="font-medium">Role</th>
              <th className="font-medium">Updated</th>
              <th className="font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {archivedUsers.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-base-content/60">
                  No archived accounts
                </td>
              </tr>
            ) : (
              paginatedArchivedUsers.map((user) => (
                <tr key={`archived-${user.id}`}>
                  <td className="text-base md:text-lg">{user.name}</td>
                  <td className="text-base md:text-lg">{user.email}</td>
                  <td className="text-base md:text-lg">{user.role}</td>
                  <td className="text-base md:text-lg">
                    {formatDate(user.updatedAt)}
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-primary bg-green-600 hover:bg-green-700 text-white"
                      onClick={async () => {
                        const confirm = await popup.showConfirm(
                          `Restore ${user.name} to active accounts?`,
                        );
                        if (!confirm) return;
                        const result = await unbanAccount([user.id]);
                        if (!result.success) {
                          popup.showError(
                            "Error restoring account: " + result.error,
                            "error",
                          );
                          return;
                        }
                        popup.showSuccess("Account restored successfully");
                        if (onRestore) onRestore([user.id]);
                      }}
                    >
                      Reactivate
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ArchivedAccountsTable;
