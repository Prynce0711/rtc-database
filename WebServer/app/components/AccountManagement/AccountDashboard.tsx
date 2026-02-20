"use client";

import { User } from "@/app/generated/prisma/browser";
import { Status } from "@/app/generated/prisma/enums";
import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import { formatDate } from "@/app/lib/utils";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { FiLock, FiPlus, FiSearch } from "react-icons/fi";
import { Pagination } from "../Pagination";
import { usePopup } from "../Popup/PopupProvider";
import { getAccounts, updateRole } from "./AccountActions";
import AccountActionsButton from "./AccountActionsButton";
import AddAccountDrawer from "./AddAccountDrawer";

type RoleFilterType = Roles | "ALL";
type TabType = (typeof tabs)[number];

const tabs = [
  "ALL",
  Status.ACTIVE,
  Status.PENDING,
  Status.SUSPENDED,
  Status.DEACTIVATED,
] as const;

const AccountDashboard = () => {
  const statusPopup = usePopup();
  const session = useSession();
  const canManage = session.data?.user?.role === Roles.ADMIN;
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [users, setUsers] = useState<User[]>([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusTab, setStatusTab] = useState<TabType>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilterType>("ALL");
  const [indicatorStyle, setIndicatorStyle] = useState<CSSProperties>({});

  // Update sliding indicator position
  useEffect(() => {
    const index = tabs.findIndex((t) => t === statusTab);
    if (index === -1) return;

    const activeTab = tabRefs.current[index];
    if (!activeTab) return;

    setIndicatorStyle({
      width: activeTab.offsetWidth,
      transform: `translateX(${activeTab.offsetLeft}px)`,
    });
  }, [statusTab, users]);

  const pageSize = 5;

  /* FETCH */
  useEffect(() => {
    getAccounts().then((result) => {
      if (!result.success) return;

      setUsers(result.result);
    });
  }, []);

  const handleRoleChange = async (user: User, newRole: Roles) => {
    const confirm = await statusPopup.showConfirm(
      `Change ${user.name}'s role to ${newRole}?`,
    );
    if (!confirm) return;

    const result = await updateRole([user.id], newRole);
    if (!result.success) {
      statusPopup.showError(
        "Failed to update role" + (result.error ? `: ${result.error}` : ""),
      );
    } else {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)),
      );
      statusPopup.showSuccess("Role updated successfully");
    }
  };

  /* FILTER */
  const processedUsers = useMemo(() => {
    return users.filter((u) => {
      const search =
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());

      const status = statusTab === "ALL" ? true : u.status === statusTab;
      const role = roleFilter === "ALL" ? true : u.role === roleFilter;

      return search && status && role;
    });
  }, [users, searchQuery, statusTab, roleFilter]);

  const paginated = processedUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const getStatusLabel = (status: Status | "ALL") => {
    if (status === "ALL") return "All Accounts";
    if (status === Status.SUSPENDED) return "Locked";
    if (status === Status.ACTIVE) return "Active";
    if (status === Status.DEACTIVATED) return "Deactivated";
    if (status === Status.PENDING) return "Pending";
    return status;
  };

  return (
    <div className="min-h-screen px-4 lg:px-8">
      <main className="max-w-375 mx-auto">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <h2 className="text-5xl font-black tracking-tight">
              Account Management
            </h2>
            <p className="text-lg opacity-60 mt-2">
              Manage user accounts and permissions
            </p>
          </div>

          {canManage && (
            <button
              className="btn btn-primary btn-lg gap-2 shadow-lg"
              onClick={() => setShowDrawer(true)}
            >
              <FiPlus size={20} /> Add Account
            </button>
          )}
        </div>

        {/* STATUS TABS */}
        <div className="relative flex p-2 rounded-full bg-base-200 border border-base-300 w-fit mb-8">
          <div
            className="absolute top-2 bottom-2 rounded-full bg-base-100 shadow transition-all duration-300"
            style={indicatorStyle}
          />

          {tabs.map((tab, index) => {
            const label = getStatusLabel(tab);

            const count =
              tab === "ALL"
                ? users.length
                : users.filter((u) => u.status === tab).length;

            return (
              <button
                key={tab}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                className={`relative z-10 px-8 py-3 font-bold text-sm transition ${
                  statusTab === tab
                    ? "text-primary"
                    : "text-base-content/60 hover:text-base-content"
                }`}
                onClick={() => {
                  setStatusTab(tab);
                  setCurrentPage(1);
                }}
              >
                {label}

                <span
                  className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                    statusTab === tab
                      ? "bg-primary/10 text-primary"
                      : "bg-base-300"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* SEARCH + FILTER */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" />

            <input
              className="input input-bordered input-md pl-12 w-full shadow-sm"
              placeholder="Search name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="select select-bordered select-md w-full sm:w-60 shadow-sm"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilterType)}
          >
            <option value="ALL">All Roles</option>
            <option value={Roles.USER}>Staff</option>
            <option value={Roles.ATTY}>Attorney</option>
          </select>
        </div>

        {/* TABLE / EMPTY STATE */}
        <div className="bg-base-100 rounded-2xl shadow-lg border border-base-300 overflow-hidden min-h-[9s00px] flex flex-col">
          {paginated.length === 0 ? (
            /* ⭐ CENTERED EMPTY STATE */
            <div className="flex flex-1 items-center justify-center p-10">
              <div className="text-center max-w-md animate-in fade-in zoom-in-95 duration-300">
                {/* ICON */}
                <div className="mx-auto w-24 h-24 flex items-center justify-center mb-6 ">
                  <FiSearch size={80} className="opacity-40" />
                </div>

                {/* TITLE */}
                <h3 className="text-2xl font-black mb-3">No Accounts Found</h3>

                {/* DESCRIPTION */}
                <p className="opacity-60 text-base leading-relaxed">
                  We couldn't find any matching accounts. Try adjusting your
                  search or filters.
                </p>

                {/* CTA */}
                {canManage && (
                  <button
                    className="btn btn-primary btn-lg mt-7 gap-2 shadow-lg hover:scale-105 transition"
                    onClick={() => setShowDrawer(true)}
                  >
                    <FiPlus size={20} />
                    Create Account
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* TABLE */}
              <div className="overflow-x-auto">
                <table className="table table-lg table-zebra text-center">
                  <thead>
                    <tr className="text-sm uppercase tracking-wider">
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
                        <td className="font-semibold text-sm">{user.name}</td>

                        <td className="opacity-70 text-sm">{user.email}</td>

                        {/* ROLE */}
                        <td>
                          {user.role === Roles.ADMIN ||
                          user.status === Status.PENDING ? (
                            <span className="font-semibold text-base-content  opacity-70 text-sm">
                              {user.role}
                            </span>
                          ) : (
                            <select
                              className="select select-sm select-bordered"
                              value={user.role}
                              onChange={(e) =>
                                handleRoleChange(user, e.target.value as Roles)
                              }
                            >
                              <option value={Roles.USER}>Staff</option>
                              <option value={Roles.ATTY}>Attorney</option>
                            </select>
                          )}
                        </td>

                        {/* STATUS */}
                        <td>
                          <span
                            className={`
    inline-flex items-center gap-2
    px-4 py-1.5
    text-xs font-semibold
    rounded-full
    border backdrop-blur-sm
    transition-all duration-200
    ${
      user.status === Status.ACTIVE
        ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
        : user.status === Status.DEACTIVATED
          ? "bg-red-500/10 text-red-600 border-red-500/20"
          : user.status === Status.PENDING
            ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
            : "bg-base-200/60 text-base-content/60 border-base-300"
    }
  `}
                          >
                            {/* STATUS INDICATOR */}
                            {user.status === Status.SUSPENDED ? (
                              <FiLock className="w-3.5 h-3.5 opacity-70" />
                            ) : user.status === Status.PENDING ? (
                              <span className="loading loading-spinner loading-xs" />
                            ) : (
                              <span
                                className={`
        w-1.5 h-1.5 rounded-full
        ${user.status === Status.ACTIVE ? "bg-emerald-500" : "bg-red-500"}
      `}
                              />
                            )}

                            {getStatusLabel(user.status)}
                          </span>
                        </td>

                        <td className="opacity-70 text-sm">
                          {formatDate(user.createdAt)}
                        </td>

                        <td className="opacity-70 text-sm">
                          {formatDate(user.updatedAt)}
                        </td>

                        {canManage && (
                          <td>
                            <AccountActionsButton
                              user={user}
                              updateUser={(user) => {
                                setUsers((prev) =>
                                  prev.map((u) =>
                                    u.id === user.id ? user : u,
                                  ),
                                );
                              }}
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION CENTERED */}
              <div className="py-8 flex justify-center">
                <Pagination
                  currentPage={currentPage}
                  pageCount={Math.ceil(processedUsers.length / pageSize)}
                  onPageChange={setCurrentPage}
                />
              </div>
            </>
          )}
        </div>

        {/* DRAWER */}
        <AddAccountDrawer
          isOpen={showDrawer}
          onClose={() => setShowDrawer(false)}
          onCreate={(u) =>
            setUsers((prev) => [
              {
                ...u,
                role: u.role ?? Roles.USER,
                status: Status.PENDING,
              },
              ...prev,
            ])
          }
        />
      </main>
    </div>
  );
};

export default AccountDashboard;
