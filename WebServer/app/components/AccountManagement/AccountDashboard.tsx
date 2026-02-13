"use client";

import { Status } from "@/app/generated/prisma/enums";
import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import { formatDate } from "@/app/lib/utils";
import { useEffect, useState } from "react";
import { Pagination } from "../Pagination";
import { usePopup } from "../Popup/PopupProvider";
import { getAccounts } from "./AccountActions";
import AddAccountModal, { MockUser } from "./AddAccountModal";

type ExtendedStatus = Status | "PENDING";

type DashboardUser = MockUser & {
  status: ExtendedStatus;
};

const AccountDashboard = () => {
  const popup = usePopup();
  const session = useSession();
  const canManage = session.data?.user?.role === Roles.ADMIN;

  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const pageSize = 5;

  /* FETCH */

  useEffect(() => {
    const fetchUsers = async () => {
      const result = await getAccounts();
      if (!result.success) return;

      const mapped = result.result.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role ?? Roles.USER,
        status: u.status,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      }));

      setUsers(mapped as DashboardUser[]);
    };

    fetchUsers();
  }, []);

  /* STATUS UPDATE */

  const updateStatus = (id: string, status: ExtendedStatus) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status } : u)));
  };

  /* ROLE UPDATE */

  const updateRole = (id: string, newRole: Roles) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, role: newRole } : u)),
    );
    popup.showSuccess("Role updated");
  };

  /* ACTION BUTTONS */

  const renderActions = (user: DashboardUser) => {
    if (!canManage) return null;

    if (user.status === "PENDING")
      return (
        <button
          className="btn btn-xs btn-info"
          onClick={() => popup.showSuccess("Reminder Sent")}
        >
          Reminder
        </button>
      );

    if (user.status === Status.LOCKED)
      return (
        <button
          className="btn btn-xs btn-success"
          onClick={() => updateStatus(user.id, Status.ACTIVE)}
        >
          Unlock
        </button>
      );

    if (user.status === Status.INACTIVE)
      return (
        <button
          className="btn btn-xs btn-success"
          onClick={() => updateStatus(user.id, Status.ACTIVE)}
        >
          Reactivate
        </button>
      );

    return (
      <div className="flex gap-2">
        <button
          className="btn btn-xs btn-error"
          onClick={() => updateStatus(user.id, Status.INACTIVE)}
        >
          Deactivate
        </button>

        <button
          className="btn btn-xs btn-warning"
          onClick={() => updateStatus(user.id, Status.LOCKED)}
        >
          Lock
        </button>
      </div>
    );
  };

  const totalPages = Math.ceil(users.length / pageSize);

  const paginated = users.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <div className="min-h-screen">
      <main>
        <div className="flex justify-between mb-6">
          <h2 className="text-4xl font-bold">Account Management</h2>

          {canManage && (
            <button
              className="btn btn-primary"
              onClick={() => setShowAddModal(true)}
            >
              + Add Account
            </button>
          )}
        </div>

        <div className="overflow-x-auto bg-base-100 shadow rounded-lg">
          <table className="table table-zebra">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Updated</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>

            <tbody>
              {paginated.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>

                  <td>
                    {canManage &&
                    user.role !== Roles.ADMIN &&
                    user.status !== "PENDING" ? (
                      <select
                        className="select select-xs select-bordered"
                        value={user.role}
                        onChange={(e) =>
                          updateRole(user.id, e.target.value as Roles)
                        }
                      >
                        <option value={Roles.USER}>Staff</option>
                        <option value={Roles.ATTY}>Atty</option>
                        <option value={Roles.CLERK}>Clerk</option>
                      </select>
                    ) : (
                      <span className="font-semibold">{user.role}</span>
                    )}
                  </td>

                  <td>
                    <span
                      className={`badge ${
                        user.status === "PENDING"
                          ? "badge-info"
                          : user.status === Status.ACTIVE
                            ? "badge-success"
                            : user.status === Status.LOCKED
                              ? "badge-warning"
                              : "badge-error"
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>

                  <td>{formatDate(user.createdAt)}</td>
                  <td>{formatDate(user.updatedAt)}</td>

                  {canManage && <td>{renderActions(user)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />

        {showAddModal && (
          <AddAccountModal
            onClose={() => setShowAddModal(false)}
            onCreate={(u) => setUsers((prev) => [u, ...prev])}
          />
        )}
      </main>
    </div>
  );
};

export default AccountDashboard;
