"use client";

import { authClient, useSession } from "@/app/lib/authClient";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { ReactNode, useEffect, useState } from "react";
import { FaHistory, FaUserCog } from "react-icons/fa";
import {
  FiBarChart2,
  FiBell,
  FiChevronDown,
  FiChevronLeft,
  FiFileText,
  FiHome,
  FiLogOut,
  FiMessageSquare,
  FiMoon,
  FiSettings,
  FiSun,
  FiUsers,
} from "react-icons/fi";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SidebarProps {
  children: ReactNode;
}

interface DropdownItem {
  label: string;
  href: string;
}

interface NavItem {
  icon: ReactNode;
  href: string;
  label: string;
  dropdowns?: DropdownItem[];
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
const Tooltip = ({ label }: { label: string }) => (
  <motion.div
    initial={{ opacity: 0, x: -6 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -6 }}
    transition={{ duration: 0.12, ease: "easeOut" }}
    className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-9999 pointer-events-none"
  >
    <div className="bg-neutral text-neutral-content text-xs font-semibold px-3 py-2 rounded-lg whitespace-nowrap shadow-lg">
      {label}
      <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-neutral" />
    </div>
  </motion.div>
);

// ─── Nav Item Button ──────────────────────────────────────────────────────────
const NavBtn = ({
  item,
  isExpanded,
  activeView,
  openDropdown,
  setOpenDropdown,
  onExpandSidebar,
}: {
  item: NavItem;
  isExpanded: boolean;
  activeView: string;
  openDropdown: string | null;
  setOpenDropdown: (val: string | null) => void;
  onExpandSidebar: () => void;
}) => {
  const pathname = usePathname();
  const isActive =
    activeView === item.href || pathname.startsWith(`/user/${item.href}`);
  const currentSub = pathname.split("/")[3] || "";
  const hasDropdowns = !!item.dropdowns?.length;
  const open = openDropdown === item.href;
  const [hovered, setHovered] = useState(false);

  // Clear flyout/dropdown when sidebar expands (user will see inline dropdowns)
  useEffect(() => {
    if (isExpanded) setOpenDropdown(null);
  }, [isExpanded, setOpenDropdown]);

  // Auto-open inline dropdown when this view is active & sidebar is expanded
  useEffect(() => {
    if (isActive && hasDropdowns && isExpanded) setOpenDropdown(item.href);
  }, [isActive, hasDropdowns, item.href, setOpenDropdown, isExpanded]);

  // ── Collapsed: tooltip on hover, expand sidebar on dropdown click ──
  if (!isExpanded) {
    return (
      <div className="relative">
        {hasDropdowns ? (
          <button
            onClick={() => {
              onExpandSidebar();
              // After sidebar expands, the auto-open effect will handle opening the dropdown
              setTimeout(() => setOpenDropdown(item.href), 50);
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={[
              "relative flex items-center justify-center w-11 h-11 mx-auto rounded-xl transition-all duration-150",
              isActive
                ? "bg-primary text-primary-content shadow-sm"
                : "text-base-content/50 hover:bg-base-300/60 hover:text-base-content",
            ].join(" ")}
          >
            <span className="text-xl">{item.icon}</span>
          </button>
        ) : (
          <Link
            href={`/user/${item.href}`}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={[
              "relative flex items-center justify-center w-11 h-11 mx-auto rounded-xl transition-all duration-150",
              isActive
                ? "bg-primary text-primary-content shadow-sm"
                : "text-base-content/50 hover:bg-base-300/60 hover:text-base-content",
            ].join(" ")}
          >
            <span className="text-xl">{item.icon}</span>
          </Link>
        )}

        {/* Tooltip on hover */}
        <AnimatePresence>
          {hovered && <Tooltip label={item.label} />}
        </AnimatePresence>
      </div>
    );
  }

  // ── Expanded ──
  const btnClass = [
    "relative group flex items-center justify-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 w-full overflow-hidden text-center",
    isActive
      ? "bg-primary text-primary-content shadow-sm"
      : "text-base-content/55 hover:bg-base-300/60 hover:text-base-content",
  ].join(" ");

  return (
    <div>
      {hasDropdowns ? (
        <button
          onClick={() =>
            setOpenDropdown(openDropdown === item.href ? null : item.href)
          }
          className={btnClass}
        >
          <span className="text-[17px] shrink-0">{item.icon}</span>
          <span className="text-[13px] font-semibold flex-1 text-center whitespace-nowrap truncate">
            {item.label}
          </span>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 opacity-50"
          >
            <FiChevronDown size={14} />
          </motion.span>
        </button>
      ) : (
        <Link href={`/user/${item.href}`} className={btnClass}>
          <span className="text-[17px] shrink-0">{item.icon}</span>
          <span className="text-[13px] font-semibold flex-1 whitespace-nowrap truncate">
            {item.label}
          </span>
          {isActive && (
            <div className="h-1.5 w-1.5 rounded-full bg-primary-content/70 shrink-0" />
          )}
        </Link>
      )}

      {/* Dropdown children */}
      <AnimatePresence initial={false}>
        {open && hasDropdowns && (
          <motion.div
            key="sub"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="relative mt-0.5 ml-6 py-0.5 space-y-3">
              {/* Vertical connecting line */}
              <div className="absolute left-0 top-1 bottom-1 w-px bg-base-300" />

              {item.dropdowns!.map((d) => {
                const isSubActive =
                  currentSub === d.href || (!d.href && !currentSub && isActive);
                return (
                  <Link
                    key={d.href}
                    href={`/user/${item.href}${d.href ? `/${d.href}` : ""}`}
                    className={[
                      "group relative flex items-center pl-5 pr-3 py-1.5 rounded-r-lg transition-colors duration-150",
                      isSubActive
                        ? "text-primary font-semibold"
                        : "text-base-content/40 hover:text-base-content/70",
                    ].join(" ")}
                  >
                    {/* Horizontal branch line */}
                    <span
                      className={[
                        "absolute left-0 top-1/2 w-3 h-px transition-colors duration-150",
                        isSubActive
                          ? "bg-primary"
                          : "bg-base-300 group-hover:bg-base-content/30",
                      ].join(" ")}
                    />
                    {/* Active dot at intersection */}
                    {isSubActive && (
                      <motion.span
                        layoutId={`dot-${item.href}`}
                        className="absolute left-[-2.5px] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary"
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 30,
                        }}
                      />
                    )}
                    <span className="text-[12.5px] leading-none">
                      {d.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Action button ────────────────────────────────────────────────────────────
const ActionBtn = ({
  icon,
  label,
  onClick,
  badge,
  isExpanded,
  danger = false,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  badge?: number;
  isExpanded: boolean;
  danger?: boolean;
}) => {
  const [hovered, setHovered] = useState(false);

  // ── Collapsed ──
  if (!isExpanded) {
    return (
      <div className="relative">
        <button
          onClick={onClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={[
            "relative flex items-center justify-center w-11 h-11 mx-auto rounded-xl transition-all duration-150",
            danger
              ? "text-error hover:bg-error/10"
              : "text-base-content/50 hover:bg-base-300/60 hover:text-base-content",
          ].join(" ")}
        >
          <span className="text-xl relative">
            {icon}
            {badge ? (
              <span className="absolute -top-1.5 -right-2 min-w-4 h-4 bg-error text-error-content text-[9px] font-bold rounded-full flex items-center justify-center leading-none px-1">
                {badge > 9 ? "9+" : badge}
              </span>
            ) : null}
          </span>
        </button>
        <AnimatePresence>
          {hovered && <Tooltip label={label} />}
        </AnimatePresence>
      </div>
    );
  }

  // ── Expanded ──
  return (
    <button
      onClick={onClick}
      className={[
        "relative group flex items-center justify-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 w-full overflow-hidden text-center",
        danger
          ? "text-error hover:bg-error/10"
          : "text-base-content/55 hover:bg-base-300/60 hover:text-base-content",
      ].join(" ")}
    >
      <span className="text-[17px] shrink-0 relative">
        {icon}
        {badge ? (
          <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-error text-error-content text-[8px] font-black rounded-full flex items-center justify-center leading-none">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </span>
      <span className="text-[13px] font-semibold flex-1 whitespace-nowrap truncate">
        {label}
      </span>
    </button>
  );
};

// ─── Section label (expanded) / thin divider (collapsed) ──────────────────────
const SectionLabel = ({
  label,
  isExpanded,
  isFirst = false,
}: {
  label: string;
  isExpanded: boolean;
  isFirst?: boolean;
}) => {
  if (!isExpanded) {
    if (isFirst) return null;
    return <div className="mx-4 my-2.5 h-px bg-base-300/60" />;
  }
  return (
    <p className="text-[12px] font-black uppercase tracking-[0.14em] text-base-content/25 px-3 pt-5 pb-1.5 select-none">
      {label}
    </p>
  );
};

// ─── Nav config ───────────────────────────────────────────────────────────────
const caseNavItems: NavItem[] = [
  {
    icon: <FiFileText />,
    href: "cases",
    label: "Case Management",
    dropdowns: [
      { label: "Cases", href: "" },
      { label: "Petition", href: "petition" },
      { label: "Special Proceedings", href: "proceedings" },
      { label: "Receiving Logs", href: "Receive" },
      { label: "Notarial", href: "notarial" },
    ],
  },
  {
    icon: <FiBarChart2 />,
    href: "statistics",
    label: "Statistics",
    dropdowns: [
      { label: "Monthly Reports", href: "monthly" },
      { label: "Annual Reports", href: "annual" },
      { label: "Judgment Day", href: "judgement" },
      { label: "Summary", href: "summary" },
    ],
  },
];

const adminNavItems: NavItem[] = [
  { icon: <FiUsers />, href: "employees", label: "Employees" },
  { icon: <FaUserCog />, href: "account", label: "Account" },
  { icon: <FaHistory />, href: "activity-reports", label: "Activity Logs" },
];

// ─── User card with tooltip ───────────────────────────────────────────────────
const UserCard = ({
  name,
  role,
  isExpanded,
}: {
  name?: string | null;
  role?: string | null;
  isExpanded: boolean;
}) => {
  const [hovered, setHovered] = useState(false);
  const initial = name?.charAt(0).toUpperCase() ?? "U";

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={[
          "flex items-center rounded-xl bg-base-100 border border-base-300 overflow-hidden transition-all duration-200",
          isExpanded ? "gap-2.5 px-3 py-2.5" : "justify-center px-2 py-2",
        ].join(" ")}
      >
        <div
          className={[
            "rounded-full bg-primary/15 flex items-center justify-center shrink-0 transition-all duration-200",
            isExpanded ? "w-7 h-7" : "w-9 h-9",
          ].join(" ")}
        >
          <span
            className={[
              "font-bold text-primary",
              isExpanded ? "text-[12px]" : "text-sm",
            ].join(" ")}
          >
            {initial}
          </span>
        </div>
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              key="userinfo"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.18 }}
              className="min-w-0 overflow-hidden flex-1"
            >
              <p className="text-[12px] font-semibold truncate whitespace-nowrap leading-tight">
                {name}
              </p>
              <p className="text-[10px] text-base-content/40 capitalize whitespace-nowrap leading-tight">
                {role}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {hovered && !isExpanded && <Tooltip label={name || "User"} />}
      </AnimatePresence>
    </div>
  );
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const Sidebar: React.FC<SidebarProps> = ({ children }) => {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const activeView = pathname.split("/")[2] || "dashboard";

  const [theme, setTheme] = useState<"winter" | "dim">("winter");
  const [collapsed, setCollapsed] = useState(false);
  const isExpanded = !collapsed;
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  async function handleLogout() {
    await authClient.signOut({
      fetchOptions: { onSuccess: () => router.push("/") },
    });
  }

  const role = session?.user?.role;
  const isAdmin = role === "admin";

  return (
    <div className="flex min-h-screen bg-base-100">
      {/* ════════════════════ SIDEBAR ════════════════════ */}
      <motion.aside
        animate={{ width: isExpanded ? 272 : 72 }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className="relative flex flex-col bg-base-200 border-r border-base-300 min-h-screen shrink-0 z-30"
      >
        {/* ── Header ──────────────────────────────────── */}
        <div
          className={[
            "border-b border-base-300 flex flex-col items-center transition-all duration-200 relative",
            isExpanded ? "px-5 py-6" : "px-0 py-5",
          ].join(" ")}
        >
          {/* Logo — centered & large in both states */}
          <motion.div
            animate={{
              width: isExpanded ? 80 : 60,
              height: isExpanded ? 80 : 60,
            }}
            transition={{ duration: 0.25 }}
            className="shrink-0 flex items-center justify-center"
          >
            <Image
              src="/SupremeCourtLogo.webp"
              alt="Supreme Court"
              width={80}
              height={80}
              className="object-contain"
            />
          </motion.div>

          {/* Brand text — below logo when expanded */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                key="brand"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="text-center mt-3"
              >
                <p className="text-lg font-extrabold text-base-content leading-tight">
                  Regional Trial Court
                </p>
                <p className="text-[13px] font-medium text-base-content/40 mt-0.5">
                  Case & Employee System
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapse toggle — floats on the sidebar edge */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="absolute -right-3.5 top-1/2 -translate-y-1/2 z-50 w-7 h-7 rounded-full flex items-center justify-center bg-base-100 border border-base-300 shadow-md text-base-content/40 hover:text-base-content hover:bg-base-200 hover:shadow-lg transition-all duration-200"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <motion.span
              animate={{ rotate: collapsed ? 180 : 0 }}
              transition={{ duration: 0.25 }}
              className="flex items-center justify-center"
            >
              <FiChevronLeft size={14} />
            </motion.span>
          </button>
        </div>

        {/* ── Nav ─────────────────────────────────────── */}
        <nav
          className={[
            "flex-1 overflow-y-auto",
            isExpanded
              ? "px-2 py-2 space-y-0.5 overflow-x-hidden"
              : "px-1.5 py-3 space-y-1 overflow-x-visible",
          ].join(" ")}
        >
          {/* Main */}
          <SectionLabel label="Main" isExpanded={isExpanded} isFirst />
          <NavBtn
            item={{
              icon: <FiHome />,
              href: "dashboard",
              label: "Dashboard",
            }}
            isExpanded={isExpanded}
            activeView={activeView}
            openDropdown={openDropdown}
            setOpenDropdown={setOpenDropdown}
            onExpandSidebar={() => setCollapsed(false)}
          />

          {/* Cases */}
          <SectionLabel label="Cases" isExpanded={isExpanded} />
          {caseNavItems.map((item) => (
            <NavBtn
              key={item.href}
              item={item}
              isExpanded={isExpanded}
              activeView={activeView}
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
              onExpandSidebar={() => setCollapsed(false)}
            />
          ))}

          {/* Admin */}
          {isAdmin && (
            <>
              <SectionLabel label="Admin" isExpanded={isExpanded} />
              {adminNavItems.map((item) => (
                <NavBtn
                  key={item.href}
                  item={item}
                  isExpanded={isExpanded}
                  activeView={activeView}
                  openDropdown={openDropdown}
                  setOpenDropdown={setOpenDropdown}
                  onExpandSidebar={() => setCollapsed(false)}
                />
              ))}
            </>
          )}

          {/* Communication */}
          <SectionLabel label="Communication" isExpanded={isExpanded} />
          <ActionBtn
            icon={<FiMessageSquare />}
            label="Messages"
            badge={3}
            isExpanded={isExpanded}
            onClick={() => router.push("/user/messages")}
          />
          <ActionBtn
            icon={<FiBell />}
            label="Notifications"
            badge={5}
            isExpanded={isExpanded}
            onClick={() => router.push("/user/notifications")}
          />

          {/* Settings */}
          <SectionLabel label="Settings" isExpanded={isExpanded} />
          <ActionBtn
            icon={<FiSettings />}
            label="Settings"
            isExpanded={isExpanded}
            onClick={() => router.push("/user/settings")}
          />
          <ActionBtn
            icon={theme === "winter" ? <FiMoon /> : <FiSun />}
            label={theme === "winter" ? "Dark Mode" : "Light Mode"}
            isExpanded={isExpanded}
            onClick={() => setTheme((t) => (t === "winter" ? "dim" : "winter"))}
          />
        </nav>

        {/* ── Footer / User ──────────────────────────── */}
        <div className="border-t border-base-300 p-2 space-y-1 text-center">
          {session?.user && (
            <UserCard
              name={session.user.name}
              role={session.user.role}
              isExpanded={isExpanded}
            />
          )}

          <ActionBtn
            icon={<FiLogOut />}
            label="Logout"
            isExpanded={isExpanded}
            danger
            onClick={handleLogout}
          />
        </div>
      </motion.aside>

      {/* ════════════════════ MAIN CONTENT ════════════════════ */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <main className="min-h-screen p-6 lg:p-12 animate-fadeIn">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Sidebar;
