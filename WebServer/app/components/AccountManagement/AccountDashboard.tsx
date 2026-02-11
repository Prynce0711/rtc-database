"use client";
import { User } from "@/app/generated/prisma/browser";
import { Status } from "@/app/generated/prisma/enums";
import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import { useEffect, useMemo, useState } from "react";
import { usePopup } from "../Popup/PopupProvider";
import { changeRole, deactivateAccount, getAccounts } from "./AccountActions";
import AddAccountModal from "./AddAccountModal";

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

  useEffect(() => {
    const fetchUsers = async () => {
      const result = await getAccounts();
      if (result.success) {
        setUsers(result.result);
      } else {
        statusPopup.showError(
          "Error fetching accounts: " + result.error,
          "error",
        );
      }
    };
    fetchUsers();
  }, []);

  const formatDate = (date?: Date | string | null) =>
    date
      ? new Date(date).toLocaleDateString("en-PH", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";

  /* ===== STATS ===== */
  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.status === Status.ACTIVE).length,
      admins: users.filter((u) => u.role === Roles.ADMIN).length,
      inactive: users.filter((u) => u.status === Status.INACTIVE).length,
    }),
    [users],
  );

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
    <div className="min-h-screen bg-base-200">
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* HEADER */}
        <h2 className="text-3xl font-bold mb-2">Account Management</h2>

        <p className="opacity-70 mb-6">Manage system users</p>
        {canManage && (
          <button
            className="btn btn-primary mt-4"
            onClick={() => setShowAddModal(true)}
          >
            + Add Account
          </button>
        )}
        {/* STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            ["Total Users", stats.total],
            ["Active", stats.active],
            ["Admins", stats.admins],
            ["Inactive", stats.inactive],
          ].map(([label, value]) => (
            <div key={label} className="stat bg-base-100 shadow rounded-lg">
              <div className="stat-title">{label}</div>
              <div className="stat-value">{value}</div>
            </div>
          ))}
        </div>

        {/* SEARCH + FILTER */}
        <div className="flex gap-4 mb-4 flex-wrap">
          <input
            className="input input-bordered"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            className="select select-bordered"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as "all" | Roles)}
          >
            <option value="all">All</option>
            <option value={Roles.ADMIN}>Admin</option>
            <option value={Roles.USER}>Staff</option>
            <option value={Roles.ATTY}>Atty</option>
          </select>

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
        <div className="overflow-x-auto bg-base-100 shadow rounded-lg">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    onChange={(e) =>
                      setSelectedIds(
                        e.target.checked ? paginatedUsers.map((u) => u.id) : [],
                      )
                    }
                  />
                </th>
                <th onClick={() => setSortKey("name")}>Name</th>
                <th onClick={() => setSortKey("email")}>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Last Login</th>
                <th>Updated</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>

            <tbody>
              {paginatedUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <input
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
                        className="select select-sm"
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
                      {user.status === Status.ACTIVE && (
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
