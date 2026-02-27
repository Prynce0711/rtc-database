"use client";

import { useSession } from "@/app/lib/authClient";
import { AnimatePresence, motion } from "framer-motion";
import React, { useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiBell,
  FiCheck,
  FiChevronRight,
  FiClock,
  FiFileText,
  FiMessageSquare,
  FiSearch,
  FiSettings,
  FiShield,
  FiTrash2,
  FiUser,
  FiX,
} from "react-icons/fi";

// ─── Types ────────────────────────────────────────────────────────────────────
type NotifType =
  | "case"
  | "message"
  | "system"
  | "alert"
  | "assignment"
  | "deadline"
  | "account";

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  link?: string;
  actor?: {
    name: string;
    role: "admin" | "atty" | "user";
    avatar?: string;
  };
  metadata?: {
    caseNumber?: string;
    priority?: "low" | "medium" | "high" | "urgent";
  };
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const mockNotifications: Notification[] = [
  {
    id: "n1",
    type: "alert",
    title: "Urgent: Hearing Tomorrow",
    description:
      "Civil Case No. 2026-0145 hearing is scheduled for tomorrow at 9:00 AM, Branch 25.",
    timestamp: "2026-02-27T09:30:00",
    isRead: false,
    metadata: { caseNumber: "2026-0145", priority: "urgent" },
  },
  {
    id: "n2",
    type: "message",
    title: "New message from Atty. Maria Santos",
    description:
      '"Will do. Also, the hearing for Case No. 2026-0098 has been moved to March 5."',
    timestamp: "2026-02-27T08:10:00",
    isRead: false,
    actor: { name: "Atty. Maria Santos", role: "atty" },
  },
  {
    id: "n3",
    type: "case",
    title: "Case Status Updated",
    description:
      'Civil Case No. 2026-0098 status changed from "Pending" to "Under Review" by Atty. Carlos Reyes.',
    timestamp: "2026-02-27T07:45:00",
    isRead: false,
    actor: { name: "Atty. Carlos Reyes", role: "atty" },
    metadata: { caseNumber: "2026-0098", priority: "medium" },
  },
  {
    id: "n4",
    type: "assignment",
    title: "New Case Assigned",
    description:
      "Special Proceeding No. 2026-SP-0031 has been assigned to you by Admin Rodriguez.",
    timestamp: "2026-02-27T07:00:00",
    isRead: false,
    actor: { name: "Admin Rodriguez", role: "admin" },
    metadata: { caseNumber: "2026-SP-0031", priority: "medium" },
  },
  {
    id: "n5",
    type: "deadline",
    title: "Filing Deadline Approaching",
    description:
      "The deadline for submitting the answer to Civil Case No. 2026-0120 is in 3 days (March 2, 2026).",
    timestamp: "2026-02-27T06:00:00",
    isRead: true,
    metadata: { caseNumber: "2026-0120", priority: "high" },
  },
  {
    id: "n6",
    type: "system",
    title: "System Maintenance Scheduled",
    description:
      "The system will undergo maintenance tonight from 11:00 PM to 1:00 AM. Please save all work before then.",
    timestamp: "2026-02-27T08:00:00",
    isRead: true,
    actor: { name: "Admin Patricia Lim", role: "admin" },
  },
  {
    id: "n7",
    type: "case",
    title: "New Document Uploaded",
    description:
      'A new document has been uploaded to Civil Case No. 2026-0089: "Motion for Reconsideration.pdf"',
    timestamp: "2026-02-26T16:30:00",
    isRead: true,
    actor: { name: "Juan Dela Cruz", role: "user" },
    metadata: { caseNumber: "2026-0089" },
  },
  {
    id: "n8",
    type: "account",
    title: "Password Change Successful",
    description:
      "Your account password was successfully changed. If this wasn't you, please contact an administrator immediately.",
    timestamp: "2026-02-26T14:00:00",
    isRead: true,
  },
  {
    id: "n9",
    type: "message",
    title: "New message from Elena Garcia",
    description:
      "\"Hello! I'd like to follow up on my case status. It's been two weeks since the filing.\"",
    timestamp: "2026-02-27T09:15:00",
    isRead: false,
    actor: { name: "Elena Garcia", role: "user" },
  },
  {
    id: "n10",
    type: "assignment",
    title: "Case Reassigned",
    description:
      "Civil Case No. 2026-0076 has been reassigned from Atty. Sofia Mendoza to you.",
    timestamp: "2026-02-26T10:00:00",
    isRead: true,
    actor: { name: "Admin Rodriguez", role: "admin" },
    metadata: { caseNumber: "2026-0076", priority: "low" },
  },
  {
    id: "n11",
    type: "alert",
    title: "Overdue: Case Response Needed",
    description:
      "Civil Case No. 2026-0065 requires your response. The deadline was yesterday (Feb 26).",
    timestamp: "2026-02-27T07:00:00",
    isRead: false,
    metadata: { caseNumber: "2026-0065", priority: "urgent" },
  },
  {
    id: "n12",
    type: "system",
    title: "Weekly Report Generated",
    description:
      "Your weekly case activity report for Feb 17-23 is now available for download.",
    timestamp: "2026-02-24T08:00:00",
    isRead: true,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter((w) => w[0] && w[0] === w[0].toUpperCase())
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

const getAvatarColor = (name: string) => {
  const colors = [
    "bg-primary text-primary-content",
    "bg-secondary text-secondary-content",
    "bg-accent text-accent-content",
    "bg-info text-info-content",
    "bg-success text-success-content",
    "bg-warning text-warning-content",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const getNotifIcon = (type: NotifType) => {
  switch (type) {
    case "case":
      return {
        icon: <FiFileText className="w-5 h-5" />,
        cls: "bg-info/15 text-info",
      };
    case "message":
      return {
        icon: <FiMessageSquare className="w-5 h-5" />,
        cls: "bg-primary/15 text-primary",
      };
    case "system":
      return {
        icon: <FiSettings className="w-5 h-5" />,
        cls: "bg-secondary/15 text-secondary",
      };
    case "alert":
      return {
        icon: <FiAlertCircle className="w-5 h-5" />,
        cls: "bg-error/15 text-error",
      };
    case "assignment":
      return {
        icon: <FiUser className="w-5 h-5" />,
        cls: "bg-accent/15 text-accent-content",
      };
    case "deadline":
      return {
        icon: <FiClock className="w-5 h-5" />,
        cls: "bg-warning/15 text-warning",
      };
    case "account":
      return {
        icon: <FiShield className="w-5 h-5" />,
        cls: "bg-success/15 text-success",
      };
  }
};

const getPriorityBadge = (priority?: string) => {
  switch (priority) {
    case "urgent":
      return { label: "Urgent", cls: "bg-error/15 text-error" };
    case "high":
      return { label: "High", cls: "bg-warning/15 text-warning" };
    case "medium":
      return { label: "Medium", cls: "bg-info/15 text-info" };
    case "low":
      return { label: "Low", cls: "bg-success/15 text-success" };
    default:
      return null;
  }
};

// ─── Filter Tabs ──────────────────────────────────────────────────────────────
type NotifFilter = "all" | "unread" | "case" | "message" | "system" | "alert";

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const Notifications: React.FC = () => {
  useSession();
  const [notifications, setNotifications] =
    useState<Notification[]>(mockNotifications);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<NotifFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Counts ────────────────────────────────────────────────────────────
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // ── Filtered list ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...notifications];
    // filter by tab
    if (filter === "unread") list = list.filter((n) => !n.isRead);
    else if (filter !== "all") list = list.filter((n) => n.type === filter);
    // search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.description.toLowerCase().includes(q) ||
          n.actor?.name.toLowerCase().includes(q) ||
          n.metadata?.caseNumber?.toLowerCase().includes(q),
      );
    }
    // sort by date (newest first)
    return list.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [notifications, filter, search]);

  // ── Group by date ─────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const groups: { label: string; items: Notification[] }[] = [];
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000).toDateString();

    filtered.forEach((n) => {
      const d = new Date(n.timestamp);
      let label: string;
      if (d.toDateString() === today) label = "Today";
      else if (d.toDateString() === yesterday) label = "Yesterday";
      else
        label = d.toLocaleDateString([], {
          weekday: "long",
          month: "long",
          day: "numeric",
        });

      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.label === label) {
        lastGroup.items.push(n);
      } else {
        groups.push({ label, items: [n] });
      }
    });
    return groups;
  }, [filtered]);

  // ── Actions ───────────────────────────────────────────────────────────
  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const deleteNotif = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const selectedNotif = notifications.find((n) => n.id === selectedId) ?? null;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div
      className="min-h-screen"
      style={{ padding: "var(--space-page-y) var(--space-page-x)" }}
    >
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl lg:text-4xl font-bold text-base-content tracking-tight">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span className="badge badge-primary badge-sm font-bold">
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="btn btn-outline btn-sm gap-2 rounded-lg"
              >
                <FiCheck className="w-4 h-4" />
                Mark all read
              </button>
            )}
          </div>
        </div>
        <p className="mt-1 text-base text-muted">
          Stay updated on your cases, messages, and system alerts
        </p>
      </div>

      {/* ── Search & Filters ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 w-4 h-4" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-bordered input-sm w-full pl-9 rounded-lg bg-base-200/50 focus:bg-base-100 transition-colors"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-base-200/60 rounded-lg p-0.5 flex-wrap">
          {(
            [
              { key: "all", label: "All" },
              { key: "unread", label: "Unread" },
              { key: "case", label: "Cases" },
              { key: "alert", label: "Alerts" },
              { key: "message", label: "Messages" },
              { key: "system", label: "System" },
            ] as { key: NotifFilter; label: string }[]
          ).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={[
                "text-xs font-semibold px-3 py-1.5 rounded-md transition-all duration-150",
                filter === f.key
                  ? "bg-base-100 text-base-content shadow-sm"
                  : "text-base-content/50 hover:text-base-content/70",
              ].join(" ")}
            >
              {f.label}
              {f.key === "unread" && unreadCount > 0 && (
                <span className="ml-1 text-primary">({unreadCount})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="flex gap-5">
        {/* ── Notification List ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-base-content/30">
              <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center mb-4">
                <FiBell className="w-7 h-7 text-primary/40" />
              </div>
              <h3 className="text-lg font-bold text-base-content/50 mb-1">
                No notifications
              </h3>
              <p className="text-sm text-base-content/40">
                {filter !== "all"
                  ? "No notifications match the current filter."
                  : "You're all caught up!"}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map((group) => (
                <div key={group.label}>
                  {/* Date header */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-bold text-base-content/40 uppercase tracking-wider">
                      {group.label}
                    </span>
                    <div className="flex-1 h-px bg-base-200" />
                    <span className="text-xs text-base-content/30">
                      {group.items.length}
                    </span>
                  </div>

                  {/* Notifications */}
                  <div className="space-y-2">
                    <AnimatePresence>
                      {group.items.map((notif) => {
                        const iconData = getNotifIcon(notif.type);
                        const priority = getPriorityBadge(
                          notif.metadata?.priority,
                        );
                        const isSelected = notif.id === selectedId;

                        return (
                          <motion.div
                            key={notif.id}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -40, height: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => {
                              setSelectedId(notif.id);
                              if (!notif.isRead) markAsRead(notif.id);
                            }}
                            className={[
                              "group flex items-start gap-3 px-4 py-3.5 rounded-xl cursor-pointer transition-all duration-150 border",
                              isSelected
                                ? "bg-primary/5 border-primary/20 shadow-sm"
                                : notif.isRead
                                  ? "bg-base-100 border-base-200/60 hover:bg-base-200/40 hover:border-base-200"
                                  : "bg-base-100 border-primary/10 hover:bg-primary/3 shadow-xs",
                              !notif.isRead
                                ? "border-l-[3px] border-l-primary"
                                : "border-l-[3px] border-l-transparent",
                            ].join(" ")}
                          >
                            {/* Icon / Avatar */}
                            <div className="shrink-0 mt-0.5">
                              {notif.actor ? (
                                <div className="relative">
                                  <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${getAvatarColor(notif.actor.name)}`}
                                  >
                                    {getInitials(notif.actor.name)}
                                  </div>
                                  <div
                                    className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${iconData.cls} border-2 border-base-100`}
                                  >
                                    {React.cloneElement(
                                      iconData.icon as React.ReactElement<{
                                        className?: string;
                                      }>,
                                      { className: "w-2.5 h-2.5" },
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className={`w-10 h-10 rounded-full flex items-center justify-center ${iconData.cls}`}
                                >
                                  {iconData.icon}
                                </div>
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                  <h4
                                    className={`text-sm leading-tight truncate ${
                                      notif.isRead
                                        ? "font-medium text-base-content/80"
                                        : "font-bold text-base-content"
                                    }`}
                                  >
                                    {notif.title}
                                  </h4>
                                  {priority && (
                                    <span
                                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${priority.cls}`}
                                    >
                                      {priority.label}
                                    </span>
                                  )}
                                  {notif.metadata?.caseNumber && (
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-base-200 text-base-content/50 shrink-0">
                                      {notif.metadata.caseNumber}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[11px] text-base-content/40 tabular-nums whitespace-nowrap">
                                    {formatTime(notif.timestamp)}
                                  </span>
                                  {!notif.isRead && (
                                    <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                                  )}
                                </div>
                              </div>
                              <p
                                className={`text-xs mt-1 line-clamp-2 leading-relaxed ${
                                  notif.isRead
                                    ? "text-base-content/45"
                                    : "text-base-content/65"
                                }`}
                              >
                                {notif.description}
                              </p>
                              {notif.actor && (
                                <p className="text-[11px] text-base-content/35 mt-1.5">
                                  by{" "}
                                  <span className="font-medium text-base-content/50">
                                    {notif.actor.name}
                                  </span>
                                </p>
                              )}
                            </div>

                            {/* Actions (on hover) */}
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                              {!notif.isRead && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsRead(notif.id);
                                  }}
                                  className="btn btn-ghost btn-xs btn-square rounded-lg text-base-content/40 hover:text-primary"
                                  title="Mark as read"
                                >
                                  <FiCheck className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteNotif(notif.id);
                                }}
                                className="btn btn-ghost btn-xs btn-square rounded-lg text-base-content/40 hover:text-error"
                                title="Delete"
                              >
                                <FiTrash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Detail Panel (desktop) ───────────────────────────────────── */}
        <AnimatePresence>
          {selectedNotif && (
            <motion.aside
              key="detail"
              initial={{ opacity: 0, x: 20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 380 }}
              exit={{ opacity: 0, x: 20, width: 0 }}
              transition={{ duration: 0.2 }}
              className="hidden lg:block shrink-0 overflow-hidden"
            >
              <div className="w-95 rounded-2xl border border-base-200 bg-base-100 shadow-lg sticky top-6">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-base-200">
                  <h3 className="text-sm font-bold text-base-content">
                    Details
                  </h3>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="btn btn-ghost btn-xs btn-square rounded-lg"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-5 space-y-5">
                  {/* Type & Priority */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${getNotifIcon(selectedNotif.type).cls}`}
                    >
                      {getNotifIcon(selectedNotif.type).icon}
                      <span className="capitalize">{selectedNotif.type}</span>
                    </span>
                    {selectedNotif.metadata?.priority && (
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-full ${getPriorityBadge(selectedNotif.metadata.priority)?.cls}`}
                      >
                        {
                          getPriorityBadge(selectedNotif.metadata.priority)
                            ?.label
                        }{" "}
                        Priority
                      </span>
                    )}
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        selectedNotif.isRead
                          ? "bg-base-200 text-base-content/50"
                          : "bg-primary/15 text-primary"
                      }`}
                    >
                      {selectedNotif.isRead ? "Read" : "Unread"}
                    </span>
                  </div>

                  {/* Title */}
                  <div>
                    <h2 className="text-base font-bold text-base-content leading-snug">
                      {selectedNotif.title}
                    </h2>
                    <p className="text-xs text-base-content/40 mt-1 tabular-nums">
                      {new Date(selectedNotif.timestamp).toLocaleString([], {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  {/* Description */}
                  <div className="bg-base-200/40 rounded-xl p-4">
                    <p className="text-sm text-base-content/70 leading-relaxed">
                      {selectedNotif.description}
                    </p>
                  </div>

                  {/* Case reference */}
                  {selectedNotif.metadata?.caseNumber && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-info/5 border border-info/10">
                      <FiFileText className="w-5 h-5 text-info shrink-0" />
                      <div>
                        <p className="text-xs text-base-content/50">
                          Related Case
                        </p>
                        <p className="text-sm font-bold text-base-content">
                          {selectedNotif.metadata.caseNumber}
                        </p>
                      </div>
                      <FiChevronRight className="ml-auto w-4 h-4 text-base-content/30" />
                    </div>
                  )}

                  {/* Actor info */}
                  {selectedNotif.actor && (
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-base-200">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${getAvatarColor(selectedNotif.actor.name)}`}
                      >
                        {getInitials(selectedNotif.actor.name)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-base-content">
                          {selectedNotif.actor.name}
                        </p>
                        <p className="text-xs text-base-content/50 capitalize">
                          {selectedNotif.actor.role === "atty"
                            ? "Attorney"
                            : selectedNotif.actor.role}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    {!selectedNotif.isRead && (
                      <button
                        onClick={() => markAsRead(selectedNotif.id)}
                        className="btn btn-outline btn-sm flex-1 gap-2 rounded-lg"
                      >
                        <FiCheck className="w-4 h-4" />
                        Mark as read
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotif(selectedNotif.id)}
                      className="btn btn-ghost btn-sm gap-2 rounded-lg text-error hover:bg-error/10"
                    >
                      <FiTrash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Notifications;
