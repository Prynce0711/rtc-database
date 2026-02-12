"use client";
import { User } from "@/app/generated/prisma/browser";
import { Status } from "@/app/generated/prisma/enums";
import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import { formatDate } from "@/app/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { usePopup } from "../Popup/PopupProvider";
import {
  changeRole,
  deactivateAccount,
  getAccounts,
  unbanAccount,
} from "./AccountActions";
import AddAccountModal from "./AddAccountModal";
import ArchivedAccountsTable from "./ArchivedAccountsTable";

const AccountDashboard = () => {
  const statusPopup = usePopup();
  const session = useSession();
  const canManage = session.data?.user?.role === Roles.ADMIN;

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Roles>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [bulkRole, setBulkRole] = useState<Roles | "">("");

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const [sortKey, setSortKey] = useState<keyof User>("updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [users, setUsers] = useState<User[]>([]);
  const [activeView, setActiveView] = useState<
    "all" | "accounts" | "archive" | "locked"
  >("accounts");

  useEffect(() => {
    const fetchUsers = async () => {
      const result = await getAccounts();
      if (result.success) {
        // add some temporary locked accounts for demonstration
        const mockLocked = [
          {
            id: "locked-temp-1",
            name: "Locked Demo",
            email: "locked.demo1@example.com",
            role: Roles.USER,
            status: Status.LOCKED,
            createdAt: new Date(),
            lastLogin: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "locked-temp-2",
            name: "Locked Demo 2",
            email: "locked.demo2@example.com",
            role: Roles.ATTY,
            status: Status.LOCKED,
            createdAt: new Date(),
            lastLogin: new Date(),
            updatedAt: new Date(),
          },
        ];

        setUsers([...result.result, ...mockLocked]);
      } else {
        statusPopup.showError(
          "Error fetching accounts: " + result.error,
          "error",
        );
      }
    };
    fetchUsers();
  }, []);

  /* ===== STATS ===== */
  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.status === Status.ACTIVE).length,
      admins: users.filter((u) => u.role === Roles.ADMIN).length,
      inactive: users.filter((u) => u.status === Status.INACTIVE).length,
      locked: users.filter((u) => u.status === Status.LOCKED).length,
    }),
    [users],
  );

  const formatBadgeCount = (n: number) => (n > 9 ? "9+" : String(n));

  /* ===== FILTER + SORT ===== */
  const filteredUsers = useMemo(() => {
    let data = [...users];

    if (searchTerm) {
      data = data.filter(
        (u) =>
          u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.email.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    if (roleFilter !== "all") {
      data = data.filter((u) => u.role === roleFilter);
    }

    // status filter based on activeView: accounts = ACTIVE, archive = INACTIVE, all = both
    if (activeView === "accounts") {
      data = data.filter((u) => u.status === Status.ACTIVE);
    } else if (activeView === "archive") {
      data = data.filter((u) => u.status === Status.INACTIVE);
    } else if (activeView === "locked") {
      data = data.filter((u) => u.status === Status.LOCKED);
    }

    data.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal instanceof Date && bVal instanceof Date) {
        if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
        if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
        return 0;
      }

      const aStr = String(aVal ?? "");
      const bStr = String(bVal ?? "");
      if (aStr < bStr) return sortOrder === "asc" ? -1 : 1;
      if (aStr > bStr) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return data;
  }, [users, searchTerm, roleFilter, sortKey, sortOrder]);

  /* ===== PAGINATION ===== */
  const totalPages = Math.ceil(filteredUsers.length / pageSize);

  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  /* ===== HELPERS ===== */
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  /* ===== ACTION REQUESTS ===== */

  async function requestRoleChange(user: User, newRole: Roles) {
    const confirmation = await statusPopup.showYesNo(
      `Are you sure you want to change ${user.name}'s role to ${newRole}?`,
    );
    if (!confirmation) return;

    const result = await changeRole([user.id], newRole);
    if (!result.success) {
      statusPopup.showError("Error updating role: " + result.error, "error");
      return;
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id ? { ...u, role: newRole, updatedAt: new Date() } : u,
      ),
    );
    statusPopup.showSuccess("Role updated successfully");
  }

  async function requestDeactivate(user: User) {
    const confirmation = await statusPopup.showYesNo(
      `Are you sure you want to deactivate ${user.name}'s account?`,
    );
    if (!confirmation) return;

    const result = await deactivateAccount([user.id]);
    if (!result.success) {
      statusPopup.showError(
        "Error deactivating account: " + result.error,
        "error",
      );
      return;
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id
          ? { ...u, status: Status.INACTIVE, updatedAt: new Date() }
          : u,
      ),
    );
    statusPopup.showSuccess("Account deactivated successfully");
  }

  async function requestUnlock(user: User) {
    const confirmation = await statusPopup.showYesNo(
      `Restore ${user.name} to active accounts?`,
    );
    if (!confirmation) return;

    const result = await unbanAccount([user.id]);
    if (!result.success) {
      statusPopup.showError(
        "Error restoring account: " + result.error,
        "error",
      );
      return;
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id
          ? { ...u, status: Status.ACTIVE, updatedAt: new Date() }
          : u,
      ),
    );
    statusPopup.showSuccess("Account restored successfully");
  }

  async function requestLock(user: User) {
    const confirmation = await statusPopup.showYesNo(
      `Lock ${user.name}'s account?`,
    );
    if (!confirmation) return;

    // client-side lock for demo only (no backend call)
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id
          ? { ...u, status: Status.LOCKED, updatedAt: new Date() }
          : u,
      ),
    );
    statusPopup.showSuccess("Account locked (local demo)");
  }

  async function bulkChangeRole(newRole: Roles) {
    const confirmation = await statusPopup.showYesNo(
      `Are you sure you want to change the role of ${selectedIds.length} selected users to ${newRole}?`,
    );
    if (!confirmation) return;

    const result = await changeRole(selectedIds, newRole);
    if (!result.success) {
      statusPopup.showError("Error changing roles: " + result.error, "error");
      return;
    }

    setUsers((prev) =>
      prev.map((u) =>
        selectedIds.includes(u.id)
          ? { ...u, role: newRole, updatedAt: new Date() }
          : u,
      ),
    );
    setSelectedIds([]);
    statusPopup.showSuccess("Selected users' roles updated successfully");
  }

  async function bulkDeactivate() {
    const confirmation = await statusPopup.showYesNo(
      `Are you sure you want to deactivate ${selectedIds.length} selected accounts?`,
    );
    if (!confirmation) return;
    const result = await deactivateAccount(selectedIds);
    if (!result.success) {
      statusPopup.showError(
        "Error deactivating accounts: " + result.error,
        "error",
      );
      return;
    }
    setUsers((prev) =>
      prev.map((u) =>
        selectedIds.includes(u.id)
          ? { ...u, status: Status.INACTIVE, updatedAt: new Date() }
          : u,
      ),
    );
    statusPopup.showSuccess("Selected accounts deactivated successfully");
  }

  return (
    <div className="min-h-screen">
      <main className="w-full max-w-none mx-auto">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-4xl md:text-5xl font-bold">Account Management</h2>
          {canManage && (
            <button
              className="btn btn-primary btn-md px-6"
              onClick={() => setShowAddModal(true)}
            >
              + Add Account
            </button>
          )}
        </div>

        <p className="text-lg md:text-xl opacity-70 mb-6">
          Manage system users
        </p>
        {/* STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            ["Total Users", stats.total],
            ["Active", stats.active],
            ["Admins", stats.admins],
            ["Inactive", stats.inactive],
          ].map(([label, value]) => (
            <div
              key={label}
              className="stat bg-base-100 shadow-md rounded-lg transition-shadow hover:shadow-xl"
            >
              <div className="stat-title text-base md:text-lg font-bold">
                {label}
              </div>
              <div className="stat-value text-2xl md:text-3xl font-extrabold">
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* SEARCH + FILTER */}
        <div className="flex gap-4 mb-4 flex-wrap items-center">
          <input
            className="input input-bordered input-md h-12 text-base"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            className="select select-bordered select-md h-12 text-base"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as "all" | Roles)}
          >
            <option value="all">All</option>
            <option value={Roles.ADMIN}>Admin</option>
            <option value={Roles.USER}>Staff</option>
            <option value={Roles.ATTY}>Atty</option>
          </select>

          <div className="join">
            <button
              className={`btn btn-md join-item ${
                activeView === "all" ? "btn-primary" : "btn-outline"
              }`}
              type="button"
              onClick={() => setActiveView("all")}
            >
              <span>All</span>
              <span className="ml-2 badge badge-sm badge-error text-white -mt-0">
                {formatBadgeCount(stats.total)}
              </span>
            </button>
            <button
              className={`btn btn-md join-item ${
                activeView === "accounts" ? "btn-primary" : "btn-outline"
              }`}
              type="button"
              onClick={() => setActiveView("accounts")}
            >
              <span>Accounts</span>
              <span className="ml-2 badge badge-sm badge-error text-white -mt-0">
                {formatBadgeCount(stats.active)}
              </span>
            </button>

            <button
              className={`btn btn-md join-item ${
                activeView === "archive" ? "btn-primary" : "btn-outline"
              }`}
              type="button"
              onClick={() => setActiveView("archive")}
            >
              <span>Deactivated</span>
              <span className="ml-2 badge badge-sm badge-error text-white -mt-0">
                {formatBadgeCount(stats.inactive)}
              </span>
            </button>

            <button
              className={`btn btn-md join-item ${
                activeView === "locked" ? "btn-primary" : "btn-outline"
              }`}
              type="button"
              onClick={() => setActiveView("locked")}
            >
              <span>Locked</span>
              <span className="ml-2 badge badge-sm badge-error text-white -mt-0">
                {formatBadgeCount(stats.locked)}
              </span>
            </button>
          </div>

          {canManage && selectedIds.length > 0 && (
            <>
              {/* BULK ROLE CHANGE */}
              <select
                className="select select-bordered"
                value={bulkRole}
                onChange={(e) => setBulkRole(e.target.value as Roles | "")}
              >
                <option value="">Change Role...</option>
                <option value={Roles.ADMIN}>Admin</option>
                <option value={Roles.USER}>Staff</option>
                <option value={Roles.ATTY}>Atty</option>
              </select>

              <button
                className="btn btn-primary"
                disabled={!bulkRole}
                onClick={() => bulkChangeRole(bulkRole as Roles)}
              >
                Apply Role
              </button>

              {/* BULK DEACTIVATE */}
              <button className="btn btn-error" onClick={bulkDeactivate}>
                Deactivate Selected
              </button>
            </>
          )}
        </div>

        {/* TABLE */}
        {activeView === "archive" ? (
          <ArchivedAccountsTable
            allUsers={users}
            pageSize={pageSize}
            onRestore={(ids: string[]) => {
              setUsers((prev) =>
                prev.map((u) =>
                  ids.includes(u.id)
                    ? { ...u, status: Status.ACTIVE, updatedAt: new Date() }
                    : u,
                ),
              );
              statusPopup.showSuccess("Account(s) restored successfully");
            }}
          />
        ) : (
          <div className="overflow-x-auto bg-base-100 shadow rounded-lg">
            <table className="table table-zebra text-base md:text-lg">
              <thead>
                <tr>
                  <th>
                    <input
                      className="checkbox checkbox-sm"
                      type="checkbox"
                      onChange={(e) =>
                        setSelectedIds(
                          e.target.checked
                            ? paginatedUsers.map((u) => u.id)
                            : [],
                        )
                      }
                    />
                  </th>
                  <th
                    className="text-base md:text-lg font-medium"
                    onClick={() => setSortKey("name")}
                  >
                    Name
                  </th>
                  <th
                    className="text-base md:text-lg font-medium"
                    onClick={() => setSortKey("email")}
                  >
                    Email
                  </th>
                  <th className="text-base md:text-lg font-medium">Role</th>
                  <th className="text-base md:text-lg font-medium">Status</th>
                  <th className="text-base md:text-lg font-medium">Created</th>
                  <th className="text-base md:text-lg font-medium">
                    Last Login
                  </th>
                  <th className="text-base md:text-lg font-medium">Updated</th>

                  {canManage && (
                    <th className="text-base md:text-lg font-medium">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {paginatedUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <input
                        className="checkbox checkbox-sm"
                        type="checkbox"
                        checked={selectedIds.includes(user.id)}
                        onChange={() => toggleSelect(user.id)}
                      />
                    </td>
                    <td className="flex items-center gap-2">{user.name}</td>
                    <td>{user.email}</td>

                    <td>
                      {canManage ? (
                        <select
                          className="select select-md h-11 text-base"
                          value={user.role || Roles.USER}
                          onChange={(e) =>
                            requestRoleChange(user, e.target.value as Roles)
                          }
                        >
                          <option value={Roles.ADMIN}>Admin</option>
                          <option value={Roles.USER}>Staff</option>
                          <option value={Roles.ATTY}>Atty</option>
                        </select>
                      ) : (
                        user.role || Roles.USER
                      )}
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          user.status === Status.ACTIVE
                            ? "badge-success"
                            : "badge-error"
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>

                    <td>{formatDate(user.createdAt)}</td>
                    <td>{formatDate(user.lastLogin)}</td>
                    <td>{formatDate(user.updatedAt)}</td>

                    {canManage && (
                      <td>
                        {user.status === Status.LOCKED ? (
                          <button
                            className="btn btn-sm btn-primary bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => requestUnlock(user)}
                          >
                            Unlock
                          </button>
                        ) : (
                          <button
                            className="btn btn-xs btn-error"
                            onClick={() => requestDeactivate(user)}
                          >
                            Deactivate
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}
        <div className="flex justify-end mt-4 gap-2">
          <button
            className="btn btn-sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            Prev
          </button>
          <span className="px-2 text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="btn btn-sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
        {/* ADD ACCOUNT MODAL */}
        {showAddModal && (
          <AddAccountModal
            onClose={() => setShowAddModal(false)}
            onCreate={(user) => {
              setUsers((prev) => [user, ...prev]);
              setShowAddModal(false);
            }}
          />
        )}
      </main>
    </div>
  );
};

export default AccountDashboard;
