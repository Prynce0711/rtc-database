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

// ─── Types ────────────────────────────────────────────────────────────────────
type RoleFilterType = Roles | "ALL";
type TabType = (typeof tabs)[number];
type SortKey = keyof Pick<
  User,
  "name" | "email" | "role" | "status" | "createdAt" | "updatedAt"
>;
type SortOrder = "asc" | "desc";

const tabs = [
  "ALL",
  Status.ACTIVE,
  Status.PENDING,
  Status.SUSPENDED,
  Status.DEACTIVATED,
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getStatusLabel = (status: Status | "ALL") => {
  if (status === "ALL") return "All";
  if (status === Status.SUSPENDED) return "Locked";
  if (status === Status.ACTIVE) return "Active";
  if (status === Status.DEACTIVATED) return "Deactivated";
  if (status === Status.PENDING) return "Pending";
  return status;
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: Status }) => {
  const config: Record<string, { cls: string; dot?: string }> = {
    [Status.ACTIVE]: {
      cls: "bg-success/8 text-success border-success/15",
      dot: "bg-success",
    },
    [Status.DEACTIVATED]: {
      cls: "bg-error/8 text-error border-error/15",
      dot: "bg-error",
    },
    [Status.PENDING]: { cls: "bg-info/8 text-info border-info/15" },
    [Status.SUSPENDED]: {
      cls: "bg-base-200 text-base-content/50 border-base-200",
    },
  };
  const { cls, dot } = config[status] ?? {
    cls: "bg-base-200 text-base-content/50 border-base-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold border ${cls}`}
    >
      {status === Status.SUSPENDED ? (
        <FiLock size={10} />
      ) : status === Status.PENDING ? (
        <span className="loading loading-spinner loading-xs" />
      ) : dot ? (
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      ) : null}
      {getStatusLabel(status)}
    </span>
  );
};

// ─── Sort Header ──────────────────────────────────────────────────────────────
const SortTh = ({
  label,
  colKey,
  sortKey,
  sortOrder,
  onSort,
}: {
  label: string;
  colKey: SortKey;
  sortKey: SortKey;
  sortOrder: SortOrder;
  onSort: (k: SortKey) => void;
}) => {
  const isActive = sortKey === colKey;
  return (
    <th
      onClick={() => onSort(colKey)}
      className="py-5 px-6 text-[14px] font-black uppercase tracking-[0.14em] text-base-content/70 text-center cursor-pointer select-none hover:text-base-content transition-colors whitespace-nowrap"
    >
      <span className="inline-flex items-center justify-center gap-1">
        {label}
        {isActive ? (
          <span className="text-primary text-xs">
            {sortOrder === "asc" ? "↑" : "↓"}
          </span>
        ) : (
          <span className="opacity-25 text-xs">↕</span>
        )}
      </span>
    </th>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────
const AccountDashboard = () => {
  const statusPopup = usePopup();
  const session = useSession();
  const canManage = session.data?.user?.role === Roles.ADMIN;
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [statusTab, setStatusTab] = useState<TabType>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilterType>("ALL");
  const [indicatorStyle, setIndicatorStyle] = useState<CSSProperties>({});
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const pageSize = 10;

  // ── Tab indicator ──────────────────────────────────────────────────────────
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

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    getAccounts().then((result) => {
      if (!result.success) return;
      setUsers(result.result);
      setLoading(false);
    });
  }, []);

  // ── Sort handler ───────────────────────────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  // ── Role change ────────────────────────────────────────────────────────────
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

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const processedUsers = useMemo(() => {
    const filtered = users.filter((u) => {
      const search =
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());
      const status = statusTab === "ALL" ? true : u.status === statusTab;
      const role = roleFilter === "ALL" ? true : u.role === roleFilter;
      return search && status && role;
    });

    return [...filtered].sort((a, b) => {
      const aVal = String(a[sortKey] ?? "");
      const bVal = String(b[sortKey] ?? "");
      return sortOrder === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    });
  }, [users, searchQuery, statusTab, roleFilter, sortKey, sortOrder]);

  const paginated = processedUsers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <span className="loading loading-spinner loading-md text-primary/40" />
          <p className="text-[12px] font-bold uppercase tracking-widest text-base-content/25 select-none">
            Loading accounts…
          </p>
        </div>
      </div>
    );
  }

  // ── Full-page drawer ───────────────────────────────────────────────────────
  if (showDrawer) {
    return (
      <AddAccountDrawer
        onClose={() => setShowDrawer(false)}
        onCreate={(u) => {
          setUsers((prev) => [
            { ...u, role: u.role ?? Roles.USER, status: Status.PENDING },
            ...prev,
          ]);
          setShowDrawer(false);
        }}
      />
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen px-4 lg:px-8">
      <main className="max-w-375 mx-auto">
        {/* ── HEADER ───────────────────────────────────────── */}
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
              className="btn btn-primary btn-md gap-2 shadow-lg"
              onClick={() => setShowDrawer(true)}
            >
              <FiPlus size={20} /> Add Account
            </button>
          )}
        </div>

        {/* ── STATUS TABS ──────────────────────────────────── */}
        <div className="relative flex p-1.5 rounded-full bg-base-200 border border-base-200 w-fit mb-8">
          <div
            className="absolute top-1.5 bottom-1.5 rounded-full bg-base-100 shadow-sm transition-all duration-300 ease-out"
            style={indicatorStyle}
          />
          {tabs.map((tab, index) => {
            const label = getStatusLabel(tab);
            const count =
              tab === "ALL"
                ? users.length
                : users.filter((u) => u.status === tab).length;
            const isActive = statusTab === tab;
            return (
              <button
                key={tab}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                onClick={() => {
                  setStatusTab(tab);
                  setCurrentPage(1);
                }}
                className={[
                  "relative z-10 px-5 py-2 rounded-full text-[13px] font-bold transition-colors duration-150 flex items-center gap-2",
                  isActive
                    ? "text-primary"
                    : "text-base-content/40 hover:text-base-content/70",
                ].join(" ")}
              >
                {label}
                <span
                  className={[
                    "px-1.5 py-0.5 rounded-full text-[10px] font-black min-w-[18px] text-center",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "bg-base-300 text-base-content/40",
                  ].join(" ")}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── SEARCH + FILTER ──────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1 max-w-md">
            <FiSearch
              size={14}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/30"
            />
            <input
              className="w-full h-[42px] pl-10 pr-4 rounded-xl border border-base-200 bg-base-100 text-[14px] placeholder:text-base-content/25 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
              placeholder="Search name or email…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <select
            className="h-[42px] px-4 rounded-xl border border-base-200 bg-base-100 text-[14px] text-base-content/70 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all w-full sm:w-48"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as RoleFilterType);
              setCurrentPage(1);
            }}
          >
            <option value="ALL">All Roles</option>
            <option value={Roles.USER}>Staff</option>
            <option value={Roles.ATTY}>Attorney</option>
          </select>
        </div>

        {/* ── TABLE ────────────────────────────────────────── */}
        <div className="bg-base-100 rounded-xl border border-base-200 overflow-hidden">
          {paginated.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="flex items-center justify-center mb-1">
                <FiSearch size={64} className="text-base-content/25" />
              </div>
              <p className="text-2xl font-semibold text-base-content/35">
                No accounts found.
              </p>
              <p className="text-md text-base-content/30">
                Try adjusting your search or filters.
              </p>
              {canManage && (
                <button
                  onClick={() => setShowDrawer(true)}
                  className="mt-3 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-content text-[13px] font-bold hover:brightness-110 transition-all"
                >
                  <FiPlus size={14} /> Create Account
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto text-xl">
                <table className="w-full text-xl">
                  {/* HEADER */}
                  <thead className="text-xl">
                    <tr className="text-xl border-b border-base-200 bg-base-200 ">
                      <SortTh
                        label="Name"
                        colKey="name"
                        sortKey={sortKey}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                      />
                      <SortTh
                        label="Email"
                        colKey="email"
                        sortKey={sortKey}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                      />
                      <SortTh
                        label="Role"
                        colKey="role"
                        sortKey={sortKey}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                      />
                      <SortTh
                        label="Status"
                        colKey="status"
                        sortKey={sortKey}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                      />
                      <SortTh
                        label="Created"
                        colKey="createdAt"
                        sortKey={sortKey}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                      />
                      <SortTh
                        label="Updated"
                        colKey="updatedAt"
                        sortKey={sortKey}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                      />
                      {canManage && (
                        <th className="py-4 px-5 text-[11px] font-bold uppercase tracking-[0.1em] text-base-content/50 text-center whitespace-nowrap">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>

                  {/* BODY */}
                  <tbody>
                    {paginated.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-base-200 last:border-0 hover:bg-base-200/50 transition-colors duration-100"
                      >
                        {/* Name */}
                        <td className="py-4 px-5 text-center font-semibold text-base-content text-[13px]">
                          {user.name}
                        </td>

                        {/* Email */}
                        <td className="py-4 px-5 text-center text-base-content/55 text-[13px]">
                          {user.email}
                        </td>

                        {/* Role */}
                        <td className="py-4 px-5 text-center">
                          {user.role === Roles.ADMIN ||
                          user.status === Status.PENDING ? (
                            <span className="text-[13px] font-semibold text-base-content/50">
                              {user.role}
                            </span>
                          ) : (
                            <select
                              className="h-8 px-3 rounded-lg border border-base-200 bg-base-100 text-[13px] font-semibold text-base-content/70 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
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

                        {/* Status */}
                        <td className="py-4 px-5 text-center">
                          <StatusBadge status={user.status} />
                        </td>

                        {/* Created */}
                        <td className="py-4 px-5 text-center text-[13px] text-base-content/45 tabular-nums">
                          {formatDate(user.createdAt)}
                        </td>

                        {/* Updated */}
                        <td className="py-4 px-5 text-center text-[13px] text-base-content/45 tabular-nums">
                          {formatDate(user.updatedAt)}
                        </td>

                        {/* Actions */}
                        {canManage && (
                          <td className="py-4 px-5 text-center">
                            <AccountActionsButton
                              user={user}
                              updateUser={(updated) =>
                                setUsers((prev) =>
                                  prev.map((u) =>
                                    u.id === updated.id ? updated : u,
                                  ),
                                )
                              }
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ──────────────────────────────── */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-base-200">
                <p className="text-[13px] text-base-content/40 font-medium">
                  Showing{" "}
                  <span className="font-semibold text-base-content/60">
                    {Math.min(
                      (currentPage - 1) * pageSize + 1,
                      processedUsers.length,
                    )}
                  </span>{" "}
                  –{" "}
                  <span className="font-semibold text-base-content/60">
                    {Math.min(currentPage * pageSize, processedUsers.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-base-content/60">
                    {processedUsers.length}
                  </span>
                </p>
                <Pagination
                  currentPage={currentPage}
                  pageCount={Math.ceil(processedUsers.length / pageSize)}
                  onPageChange={setCurrentPage}
                />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AccountDashboard;
