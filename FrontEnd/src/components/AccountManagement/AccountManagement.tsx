import React, { useEffect, useState } from "react";
import type { User } from "../../generated/prisma/client";
import { ENDPOINTS } from "../../lib/api";
import AddEditAccountModal from "./Modal/AddEditAccountModal";
import {
  AccountFormData,
  initialAccountFormData,
  validateAccountForm,
} from "./Forms/AccountForm.types";

const AccountManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<AccountFormData>(
    initialAccountFormData,
  );
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(ENDPOINTS.USERS);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setUsers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch users");
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.role?.toLowerCase() || "").includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === "ALL" || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const handleAddAccount = () => {
    setFormData(initialAccountFormData);
    setFormErrors({});
    setShowAddModal(true);
  };

  const handleEditAccount = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: undefined,
      role: (user.role as AccountFormData["role"]) || "STAFF",
      banned: user.banned || false,
      banReason: user.banReason || undefined,
      banExpires: user.banExpires ? new Date(user.banExpires) : undefined,
    });
    setFormErrors({});
    setShowEditModal(true);
  };

  const handleToggleActive = async (user: User) => {
    const newBannedState = !user.banned;

    try {
      const response = await fetch(`${ENDPOINTS.USERS}/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          banned: newBannedState,
          banReason: newBannedState ? "Deactivated by admin" : null,
          banExpires: null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update user status");
      }

      await fetchUsers();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to update user status",
      );
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this account? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`${ENDPOINTS.USERS}/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete account");
      }

      await fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete account");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validateAccountForm(formData, showEditModal);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      const url =
        showEditModal && selectedUser
          ? `${ENDPOINTS.USERS}/${selectedUser.id}`
          : ENDPOINTS.USERS;

      const payload: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        banned: formData.banned,
        banReason: formData.banned ? formData.banReason : null,
        banExpires:
          formData.banned && formData.banExpires
            ? formData.banExpires.toISOString()
            : null,
      };

      // Only include password if provided
      if (formData.password) {
        payload.password = formData.password;
      }

      const response = await fetch(url, {
        method: showEditModal ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message ||
            `Failed to ${showEditModal ? "update" : "create"} account`,
        );
      }

      await fetchUsers();
      setShowAddModal(false);
      setShowEditModal(false);
      setSelectedUser(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save account");
    }
  };

  const handleFormChange = (data: Partial<AccountFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const getRoleBadgeColor = (role?: string | null) => {
    switch (role) {
      case "SUPERADMIN":
        return "badge-error";
      case "ADMIN":
        return "badge-warning";
      case "STAFF":
        return "badge-info";
      default:
        return "badge-ghost";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span>Error: {error}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-base-content mb-2">
            Account Management
          </h2>
          <p className="opacity-70">
            Manage user accounts, roles, and permissions
          </p>
        </div>

        {/* Filters and Search */}
        <div className="flex gap-4 mb-6 flex-wrap">
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            className="input input-bordered flex-1 min-w-[250px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            className="select select-bordered"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="ALL">All Roles</option>
            <option value="STAFF">Staff</option>
            <option value="ADMIN">Admin</option>
            <option value="SUPERADMIN">Super Admin</option>
          </select>

          <button className="btn btn-primary" onClick={handleAddAccount}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
            </svg>
            Add Account
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-title">Total Accounts</div>
            <div className="stat-value text-primary">{users.length}</div>
          </div>
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-title">Active</div>
            <div className="stat-value text-success">
              {users.filter((u) => !u.banned).length}
            </div>
          </div>
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-title">Banned</div>
            <div className="stat-value text-error">
              {users.filter((u) => u.banned).length}
            </div>
          </div>
          <div className="stat bg-base-100 rounded-lg shadow">
            <div className="stat-title">Admins</div>
            <div className="stat-value text-warning">
              {
                users.filter(
                  (u) => u.role === "ADMIN" || u.role === "SUPERADMIN",
                ).length
              }
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 opacity-70">
                    No accounts found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="avatar placeholder">
                          <div className="bg-neutral text-neutral-content rounded-full w-10">
                            <span className="text-sm">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="font-bold">{user.name}</div>
                        </div>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`badge ${getRoleBadgeColor(user.role)}`}>
                        {user.role || "N/A"}
                      </span>
                    </td>
                    <td>
                      {user.banned ? (
                        <div className="flex flex-col gap-1">
                          <span className="badge badge-error">Banned</span>
                          {user.banReason && (
                            <span className="text-xs opacity-70">
                              {user.banReason}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="badge badge-success">Active</span>
                      )}
                    </td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => handleEditAccount(user)}
                          title="Edit account"
                        >
                          Edit
                        </button>
                        <button
                          className={`btn btn-sm ${user.banned ? "btn-success" : "btn-warning"} btn-ghost`}
                          onClick={() => handleToggleActive(user)}
                          title={
                            user.banned
                              ? "Activate account"
                              : "Deactivate account"
                          }
                        >
                          {user.banned ? "Activate" : "Deactivate"}
                        </button>
                        <button
                          className="btn btn-sm btn-error btn-ghost"
                          onClick={() => handleDeleteAccount(user.id)}
                          title="Delete account"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add/Edit Modal */}
        <AddEditAccountModal
          isOpen={showAddModal || showEditModal}
          isEdit={showEditModal}
          formData={formData}
          formErrors={formErrors}
          onClose={() => {
            setShowAddModal(false);
            setShowEditModal(false);
            setSelectedUser(null);
          }}
          onSubmit={handleSubmit}
          onChange={handleFormChange}
        />
      </main>
    </div>
  );
};

export default AccountManagement;
