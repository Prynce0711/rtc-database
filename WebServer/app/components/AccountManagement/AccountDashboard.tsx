"use client";

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
import { FiPlus, FiSearch } from "react-icons/fi";
import { Pagination } from "../Pagination";
import { usePopup } from "../Popup/PopupProvider";
import { getAccounts } from "./AccountActions";
import AddAccountDrawer, { MockUser } from "./AddAccountDrawer";
import ConfirmModal from "./ConfirmModal";

type RoleFilterType = Roles | "ALL";
type TabType = (typeof tabs)[number];

type ExtendedStatus = Status | "PENDING";

type DashboardUser = MockUser & {
  status: ExtendedStatus;
};

type ModalAction = {
  type: "role" | "status" | "reminder";
  user: DashboardUser;
  newValue?: string;
  title: string;
  message: string;
  confirmText: string;
  variant: "info" | "warning" | "error" | "success";
};

const tabs = [
  "ALL",
  Status.ACTIVE,
  "PENDING",
  Status.SUSPENDED,
  Status.INACTIVE,
] as const;

const AccountDashboard = () => {
  const popup = usePopup();
  const session = useSession();
  const canManage = session.data?.user?.role === Roles.ADMIN;
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [showDrawer, setShowDrawer] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusTab, setStatusTab] = useState<TabType>("ALL");

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilterType>("ALL");

  const [modalAction, setModalAction] = useState<ModalAction | null>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<CSSProperties>({});
  const tabsRef = useRef<HTMLDivElement>(null);
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

      setUsers(
        result.result.map((u) => ({
          ...u,
          role: u.role ?? Roles.USER,
        })) as DashboardUser[],
      );
    });
  }, []);

  /* ACTION HANDLERS */
  const updateStatus = (id: string, status: ExtendedStatus) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status } : u)));
    popup.showSuccess(`Account ${status.toLowerCase()} successfully`);
  };

  const updateRole = (id: string, newRole: Roles) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, role: newRole } : u)),
    );
    popup.showSuccess("Role updated successfully");
  };

  const handleRoleChange = (user: DashboardUser, newRole: Roles) => {
    setModalAction({
      type: "role",
      user,
      newValue: newRole,
      title: "Change User Role",
      message: `Are you sure you want to change ${user.name}'s role to ${newRole}?`,
      confirmText: "Change Role",
      variant: "warning",
    });
  };

  const handleStatusChange = (
    user: DashboardUser,
    newStatus: ExtendedStatus,
    action: string,
  ) => {
    const messages = {
      unlock: `Are you sure you want to unlock ${user.name}'s account?`,
      reactivate: `Are you sure you want to reactivate ${user.name}'s account?`,
      deactivate: `Are you sure you want to deactivate ${user.name}'s account? They will lose access to the system.`,
      lock: `Are you sure you want to lock ${user.name}'s account? They will be temporarily unable to log in.`,
    };

    const variants = {
      unlock: "success" as const,
      reactivate: "success" as const,
      deactivate: "error" as const,
      lock: "warning" as const,
    };

    setModalAction({
      type: "status",
      user,
      newValue: newStatus,
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Account`,
      message: messages[action as keyof typeof messages],
      confirmText: action.charAt(0).toUpperCase() + action.slice(1),
      variant: variants[action as keyof typeof variants],
    });
  };

  const handleReminder = (user: DashboardUser) => {
    setModalAction({
      type: "reminder",
      user,
      title: "Send Activation Reminder",
      message: `Send an activation reminder email to ${user.name} at ${user.email}?`,
      confirmText: "Send Reminder",
      variant: "info",
    });
  };

  const confirmAction = () => {
    if (!modalAction) return;

    switch (modalAction.type) {
      case "role":
        updateRole(modalAction.user.id, modalAction.newValue as Roles);
        break;
      case "status":
        updateStatus(
          modalAction.user.id,
          modalAction.newValue as ExtendedStatus,
        );
        break;
      case "reminder":
        popup.showSuccess("Activation reminder sent successfully");
        break;
    }

    setModalAction(null);
  };

  const renderActions = (user: DashboardUser) => {
    if (!canManage) return null;

    if (user.status === "PENDING")
      return (
        <button
          className="btn btn-xs btn-info"
          onClick={() => handleReminder(user)}
        >
          Reminder
        </button>
      );

    if (user.status === Status.SUSPENDED)
      return (
        <button
          className="btn btn-xs btn-success"
          onClick={() => handleStatusChange(user, Status.ACTIVE, "unlock")}
        >
          Unlock
        </button>
      );

    if (user.status === Status.INACTIVE)
      return (
        <button
          className="btn btn-xs btn-success"
          onClick={() => handleStatusChange(user, Status.ACTIVE, "reactivate")}
        >
          Reactivate
        </button>
      );

    return (
      <div className="flex gap-2">
        <button
          className="btn btn-xs btn-error"
          onClick={() =>
            handleStatusChange(user, Status.INACTIVE, "deactivate")
          }
        >
          Deactivate
        </button>

        <button
          className="btn btn-xs btn-warning"
          onClick={() => handleStatusChange(user, Status.SUSPENDED, "lock")}
        >
          Lock
        </button>
      </div>
    );
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
  const getStatusConfig = (status: ExtendedStatus | "ALL") => {
    if (status === "ALL") {
      return {
        label: "All Accounts",
        className: "text-primary",
      };
    }

    switch (status) {
      case Status.ACTIVE:
        return {
          label: "Active",
          className: "text-success",
        };

      case Status.SUSPENDED:
        return {
          label: "Locked",
          className: "text-warning",
        };

      case Status.INACTIVE:
        return {
          label: "Inactive",
          className: "text-error",
        };

      case "PENDING":
        return {
          label: "Pending",
          className: "text-info",
        };

      default:
        return {
          label: status,
          className: "",
        };
    }
  };

  return (
    <div className="min-h-screen">
      <main>
        {/* HEADER */}
        <div className="flex justify-between mb-6">
          <div>
            <h2 className="text-4xl font-bold">Account Management</h2>
            <p className="opacity-60">Manage user accounts and permissions</p>
          </div>

          {canManage && (
            <button
              className="btn btn-primary gap-2"
              onClick={() => setShowDrawer(true)}
            >
              <FiPlus /> Add Account
            </button>
          )}
        </div>

        {/* STATUS TABS */}
        <div
          ref={tabsRef}
          className="relative flex p-1 rounded-full bg-base-200 border border-base-300 w-fit mb-6"
        >
          {/* Sliding Indicator */}
          <div
            className="absolute top-1 bottom-1 rounded-full bg-base-100 shadow-md transition-all duration-300"
            style={indicatorStyle}
          />

          {tabs.map((tab, index) => {
            const config = getStatusConfig(tab);

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
                data-tab={tab}
                className={`relative z-10 px-6 py-2.5 flex items-center gap-2 font-semibold text-sm transition-colors duration-200 ${
                  statusTab === tab
                    ? "text-primary"
                    : "text-base-content/60 hover:text-base-content"
                }`}
                onClick={() => {
                  setStatusTab(tab);
                  setCurrentPage(1);
                }}
              >
                {config.label}

                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    statusTab === tab
                      ? "bg-primary/10 text-primary"
                      : "bg-base-300 text-base-content/60"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* SEARCH + FILTER */}
        <div className="flex gap-3 mb-6">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
            <input
              className="input input-bordered pl-10"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="select select-bordered"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilterType)}
          >
            <option value="ALL">All Roles</option>
            <option value={Roles.USER}>Staff</option>
            <option value={Roles.ATTY}>Atty</option>
          </select>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto bg-base-100 shadow rounded-xl">
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

                  {/* ROLE EDIT */}
                  <td>
                    {user.role === Roles.ADMIN || user.status === "PENDING" ? (
                      <span className="font-semibold">{user.role}</span>
                    ) : (
                      <select
                        className="select select-xs select-bordered"
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

                  {/* STATUS BADGE */}
                  <td>
                    {(() => {
                      const config = getStatusConfig(user.status);
                      return (
                        <span className={`badge ${config.className}`}>
                          {config.label}
                        </span>
                      );
                    })()}
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
          pageCount={Math.ceil(processedUsers.length / pageSize)}
          onPageChange={setCurrentPage}
        />

        <AddAccountDrawer
          isOpen={showDrawer}
          onClose={() => setShowDrawer(false)}
          onCreate={(u) =>
            setUsers((prev) => [
              {
                ...u,
                role: u.role ?? Roles.USER,
                status: "PENDING" as ExtendedStatus,
              },
              ...prev,
            ])
          }
        />

        {/* CONFIRMATION MODAL */}
        <ConfirmModal
          isOpen={!!modalAction}
          onClose={() => setModalAction(null)}
          onConfirm={confirmAction}
          title={modalAction?.title || ""}
          message={modalAction?.message || ""}
          confirmText={modalAction?.confirmText || "Confirm"}
          variant={modalAction?.variant || "warning"}
        />
      </main>
    </div>
  );
};

export default AccountDashboard;
