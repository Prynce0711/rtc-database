"use client";
import { useMemo, useState } from "react";

/* ===== MOCK SESSION ===== */
const session = {
  user: {
    role: "Admin", // change to Staff to test guard
  },
};

const canManage = session.user.role === "Admin" || session.user.role === "Atty";

const AccountDashboard = () => {
  const [bulkRole, setBulkRole] = useState("");
  const bulkChangeRole = () =>
    setConfirmAction({ type: "bulkRole", role: bulkRole });

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [confirmAction, setConfirmAction] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const [newAccount, setNewAccount] = useState({
    name: "",
    email: "",
    role: "Staff",
  });
  const requestAddAccount = () => {
    if (!newAccount.name || !newAccount.email) return;

    setConfirmAction({
      type: "addAccount",
      payload: newAccount,
    });
  };

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const [sortKey, setSortKey] = useState("updatedAt");
  const [sortOrder, setSortOrder] = useState("desc");

  const [selectedIds, setSelectedIds] = useState([]);

  const [auditLogs, setAuditLogs] = useState([]);

  const [users, setUsers] = useState([
    {
      id: 1,
      name: "Klent Russell Aguilar",
      email: "klentaguilar@gmail.com",
      role: "Admin",
      status: "Active",

      createdAt: new Date("2024-01-15"),
      lastLogin: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      name: "Juan Dela Cruz",
      email: "juan@email.com",
      role: "Staff",
      status: "Active",

      createdAt: new Date("2024-02-01"),
      lastLogin: new Date(),
      updatedAt: new Date(),
    },
  ]);

  const formatDate = (date) =>
    new Date(date).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  /* ===== STATS ===== */
  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.status === "Active").length,
      admins: users.filter((u) => u.role === "Admin").length,
      inactive: users.filter((u) => u.status === "Inactive").length,
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

    if (roleFilter !== "All") {
      data = data.filter((u) => u.role === roleFilter);
    }

    data.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
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
  const logAction = (msg) =>
    setAuditLogs((prev) => [
      { id: Date.now(), message: msg, time: new Date() },
      ...prev,
    ]);

  const toggleSelect = (id) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  /* ===== ACTION REQUESTS ===== */
  const requestRoleChange = (user, newRole) =>
    setConfirmAction({ type: "role", user, newRole });

  const requestDeactivate = (user) =>
    setConfirmAction({ type: "deactivate", user });

  const bulkDeactivate = () => setConfirmAction({ type: "bulk" });

  /* ===== CONFIRM ACTION ===== */
  const handleConfirm = () => {
    if (!confirmAction) return;
    if (confirmAction.type === "addAccount") {
      const newUser = {
        id: Date.now(),
        ...confirmAction.payload,
        status: "Active",
        createdAt: new Date(),
        lastLogin: new Date(),
        updatedAt: new Date(),
      };

      setUsers((prev) => [...prev, newUser]);

      logAction(`Account created: ${newUser.name}`);

      setNewAccount({
        name: "",
        email: "",
        role: "Staff",
      });

      setShowAddModal(false);
    }

    if (confirmAction.type === "role") {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === confirmAction.user.id
            ? { ...u, role: confirmAction.newRole, updatedAt: new Date() }
            : u,
        ),
      );
      logAction(
        `Role changed: ${confirmAction.user.name} → ${confirmAction.newRole}`,
      );
    }

    if (confirmAction.type === "deactivate") {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === confirmAction.user.id
            ? { ...u, status: "Inactive", updatedAt: new Date() }
            : u,
        ),
      );
      logAction(`User deactivated: ${confirmAction.user.name}`);
    }

    if (confirmAction.type === "bulk") {
      setUsers((prev) =>
        prev.map((u) =>
          selectedIds.includes(u.id)
            ? { ...u, status: "Inactive", updatedAt: new Date() }
            : u,
        ),
      );
      logAction(`Bulk deactivated ${selectedIds.length} users`);
      setSelectedIds([]);
    }

    // 🔥 NEW: BULK ROLE CHANGE
    if (confirmAction.type === "bulkRole") {
      setUsers((prev) =>
        prev.map((u) =>
          selectedIds.includes(u.id)
            ? { ...u, role: confirmAction.role, updatedAt: new Date() }
            : u,
        ),
      );
      logAction(
        `Bulk role change → ${confirmAction.role} (${selectedIds.length} users)`,
      );
      setSelectedIds([]);
      setBulkRole("");
    }

    setConfirmAction(null);
  };

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
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option>All</option>
            <option>Admin</option>
            <option>Staff</option>
            <option>Atty</option>
          </select>

          {canManage && selectedIds.length > 0 && (
            <>
              {/* BULK ROLE CHANGE */}
              <select
                className="select select-bordered"
                value={bulkRole}
                onChange={(e) => setBulkRole(e.target.value)}
              >
                <option value="">Change Role...</option>
                <option value="Admin">Admin</option>
                <option value="Staff">Staff</option>
                <option value="Atty">Atty</option>
              </select>

              <button
                className="btn btn-primary"
                disabled={!bulkRole}
                onClick={bulkChangeRole}
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
                        value={user.role}
                        onChange={(e) =>
                          requestRoleChange(user, e.target.value)
                        }
                      >
                        <option>Admin</option>
                        <option>Staff</option>
                        <option>Atty</option>
                      </select>
                    ) : (
                      user.role
                    )}
                  </td>

                  <td>
                    <span
                      className={`badge ${
                        user.status === "Active"
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
                      {user.status === "Active" && (
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
                    setNewAccount({ ...newAccount, role: e.target.value })
                  }
                >
                  <option>Admin</option>
                  <option>Staff</option>
                  <option>Atty</option>
                </select>
              </div>

              <div className="modal-action">
                <button className="btn" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>

                <button className="btn btn-primary" onClick={requestAddAccount}>
                  Create Account
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CONFIRM MODAL */}
        {confirmAction && (
          <div className="modal modal-open">
            <div className="modal-box">
              <h3 className="font-bold text-lg">Confirm Action</h3>
              <p className="py-4">Are you sure?</p>
              <div className="modal-action">
                <button className="btn" onClick={() => setConfirmAction(null)}>
                  Cancel
                </button>
                <button className="btn btn-error" onClick={handleConfirm}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AccountDashboard;
