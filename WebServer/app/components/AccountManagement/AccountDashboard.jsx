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
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [confirmAction, setConfirmAction] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const [newAccount, setNewAccount] = useState({
    name: "",
    email: "",
    role: "Staff",
    password: "",
  });
  const requestAddAccount = () => {
    if (!newAccount.name || !newAccount.email || !newAccount.password) return;

    setConfirmAction({
      type: "addAccount",
      payload: newAccount,
    });
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [archivePage, setArchivePage] = useState(1);
  const pageSize = 5;

  const [sortKey, setSortKey] = useState("updatedAt");
  const [sortOrder, setSortOrder] = useState("desc");

  const [auditLogs, setAuditLogs] = useState([]);
  const [activeView, setActiveView] = useState("accounts");
  const [selectedIds, setSelectedIds] = useState([]);

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

  const archivedUsers = useMemo(
    () => users.filter((u) => u.status === "Inactive"),
    [users],
  );

  const archiveTotalPages = Math.max(
    1,
    Math.ceil(archivedUsers.length / pageSize),
  );

  const paginatedArchivedUsers = archivedUsers.slice(
    (archivePage - 1) * pageSize,
    archivePage * pageSize,
  );

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
  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = (ids) => {
    const allSelected = ids.every((id) => selectedIds.includes(id));
    setSelectedIds(
      allSelected
        ? selectedIds.filter((id) => !ids.includes(id))
        : [...new Set([...selectedIds, ...ids])],
    );
  };

  const requestBulkDeactivate = () =>
    setConfirmAction({ type: "bulkDeactivate" });

  /* ===== ACTION REQUESTS ===== */
  const requestRoleChange = (user, newRole) =>
    setConfirmAction({ type: "role", user, newRole });

  const requestDeactivate = (user) =>
    setConfirmAction({ type: "deactivate", user });

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
        password: "",
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
    if (confirmAction.type === "bulkDeactivate") {
      setUsers((prev) =>
        prev.map((u) =>
          selectedIds.includes(u.id)
            ? { ...u, status: "Inactive", updatedAt: new Date() }
            : u,
        ),
      );
      setSelectedIds([]);
    }

    setConfirmAction(null);
  };

  return (
    <div className="min-h-screen bg-base-200">
      <main className="w-full max-w-none mx-auto px-4 py-8">
        {/* HEADER */}
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
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option>All</option>
            <option>Admin</option>
            <option>Staff</option>
            <option>Atty</option>
          </select>

          <div className="join">
            <button
              className={`btn btn-md join-item ${
                activeView === "accounts" ? "btn-primary" : "btn-outline"
              }`}
              type="button"
              onClick={() => setActiveView("accounts")}
            >
              Accounts
            </button>
            <button
              className={`btn btn-md join-item ${
                activeView === "archive" ? "btn-primary" : "btn-outline"
              }`}
              type="button"
              onClick={() => setActiveView("archive")}
            >
              Archive
            </button>
          </div>
        </div>
        {canManage && selectedIds.length > 0 && activeView === "accounts" && (
          <div className="flex gap-2 mb-3">
            <button
              className="btn btn-error btn-sm"
              onClick={requestBulkDeactivate}
            >
              Deactivate Selected ({selectedIds.length})
            </button>

            <button
              className="btn btn-outline btn-sm"
              onClick={() => setSelectedIds([])}
            >
              Deselect All
            </button>
          </div>
        )}

        {activeView === "archive" ? (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Archived Accounts</h3>
              <span className="text-sm text-base-content/60">
                {archivedUsers.length} archived
              </span>
            </div>

            <div className="overflow-x-auto bg-base-100 shadow rounded-lg">
              <table className="table table-zebra text-base md:text-lg">
                <thead>
                  <tr>
                    {canManage && (
                      <th>
                        <input
                          type="checkbox"
                          className="checkbox"
                          onChange={() =>
                            toggleSelectAll(
                              paginatedUsers
                                .filter((u) => u.status === "Active")
                                .map((u) => u.id),
                            )
                          }
                          checked={paginatedUsers
                            .filter((u) => u.status === "Active")
                            .every((u) => selectedIds.includes(u.id))}
                        />
                      </th>
                    )}

                    <th className="font-medium">Name</th>
                    <th className="font-medium">Email</th>
                    <th className="font-medium">Role</th>
                    <th className="font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedUsers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="text-center text-base-content/60"
                      >
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="flex justify-end mt-4 gap-2 px-4 pb-4">
                <button
                  className="btn btn-sm"
                  disabled={archivePage === 1}
                  onClick={() => setArchivePage((p) => p - 1)}
                >
                  Prev
                </button>
                <span className="px-2 text-sm">
                  Page {archivePage} of {archiveTotalPages}
                </span>
                <button
                  className="btn btn-sm"
                  disabled={archivePage === archiveTotalPages}
                  onClick={() => setArchivePage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto bg-base-100 shadow rounded-lg">
              <table className="table table-zebra text-base md:text-lg">
                <thead>
                  <tr>
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
                    <th className="text-base md:text-lg font-medium">
                      Created
                    </th>
                    <th className="text-base md:text-lg font-medium">
                      Last Login
                    </th>
                    <th className="text-base md:text-lg font-medium">
                      Updated
                    </th>
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
                      {canManage && (
                        <td>
                          {user.status === "Active" && (
                            <input
                              type="checkbox"
                              className="checkbox"
                              checked={selectedIds.includes(user.id)}
                              onChange={() => toggleSelect(user.id)}
                            />
                          )}
                        </td>
                      )}

                      <td className="flex items-center gap-2 text-lg md:text-xl font-normal">
                        {user.name}
                      </td>
                      <td className="text-lg md:text-xl font-normal">
                        {user.email}
                      </td>

                      <td>
                        {canManage ? (
                          <select
                            className="select select-md h-11 text-base"
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
                          className={`badge badge-lg ${
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
                              className="btn btn-sm btn-error"
                              onClick={() => requestDeactivate(user)}
                            >
                              Archive
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
          </>
        )}
        {/* ADD ACCOUNT MODAL */}
        {showAddModal && (
          <div className="modal modal-open">
            <div className="modal-box max-w-4xl p-0">
              <div className="bg-gradient-to-r from-primary to-info text-primary-content rounded-t-2xl px-6 py-4 relative">
                <button
                  className="btn btn-sm btn-ghost absolute right-3 top-3 text-primary-content"
                  onClick={() => setShowAddModal(false)}
                  aria-label="Close"
                >
                  ✕
                </button>
                <h3 className="text-xl md:text-2xl font-semibold">
                  Add New Account
                </h3>
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
                          setNewAccount({
                            ...newAccount,
                            email: e.target.value,
                          })
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
                          setNewAccount({ ...newAccount, role: e.target.value })
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
                          setNewAccount({
                            ...newAccount,
                            password: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-action px-6 pb-6">
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
