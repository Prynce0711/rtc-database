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
  const [archivePage] = useState(1);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const popup = usePopup();

  const archivedUsers = allUsers.filter((u) => u.status === "INACTIVE");

  const paginatedArchivedUsers = archivedUsers.slice(
    (archivePage - 1) * pageSize,
    archivePage * pageSize,
  );

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
                <td colSpan={5} className="text-center text-base-content/60">
                  No archived accounts
                </td>
              </tr>
            ) : (
              paginatedArchivedUsers.map((user) => (
                <tr key={`archived-${user.id}`}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{formatDate(user.updatedAt)}</td>

                  <td>
                    <button
                      className={`btn btn-sm btn-primary bg-green-600 hover:bg-green-700 text-white ${
                        loadingId === user.id ? "loading" : ""
                      }`}
                      disabled={loadingId === user.id}
                      onClick={async () => {
                        const confirm = await popup.showYesNo(
                          `Restore ${user.name} to active accounts?`,
                        );
                        if (!confirm) return;

                        try {
                          setLoadingId(user.id);

                          const result = await unbanAccount([user.id]);
                          if (!result.success) {
                            popup.showError(
                              "Error restoring account: " + result.error,
                              "error",
                            );
                            return;
                          }

                          popup.showSuccess("Account restored successfully");
                          onRestore?.([user.id]);
                        } finally {
                          setLoadingId(null);
                        }
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
