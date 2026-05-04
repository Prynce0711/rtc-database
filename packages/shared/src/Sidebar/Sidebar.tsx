"use client";

import { AnimatePresence, motion } from "framer-motion";
import React, { ReactNode, useEffect, useState } from "react";
import { FaHistory, FaUserCog } from "react-icons/fa";
import {
  FiBarChart2,
  FiChevronDown,
  FiChevronsLeft,
  FiChevronsRight,
  FiFileText,
  FiHome,
  FiLogOut,
  FiMessageSquare,
  FiMoon,
  FiSettings,
  FiSun,
  FiUsers,
} from "react-icons/fi";
import {
  AdaptiveImage as Image,
  AdaptiveLink as Link,
  useAdaptivePathname as usePathname,
  useAdaptiveNavigation as useRouter,
} from "../lib/nextCompat";
import {
  SidebarAdapterProps,
  SidebarSession,
  SidebarTheme,
  SidebarThemeUpdateResult,
} from "./SidebarAdapter";
// --- Types --------------------------------------------------------------------
export interface SidebarProps extends SidebarAdapterProps {
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

// --- Tooltip ------------------------------------------------------------------
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

// --- Nav Item Button ----------------------------------------------------------
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
  const currentSub = pathname.split("/")[3] || "";
  const hasDropdowns = !!item.dropdowns?.length;
  const itemBasePath = `/user/${item.href}`;
  const isActive = hasDropdowns
    ? pathname === itemBasePath ||
      item.dropdowns!.some((dropdown) => {
        const dropdownPath = `${itemBasePath}/${dropdown.href}`;
        return (
          pathname === dropdownPath || pathname.startsWith(`${dropdownPath}/`)
        );
      })
    : activeView === item.href || pathname.startsWith(itemBasePath);
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

  // -- Collapsed: tooltip on hover, expand sidebar on dropdown click --
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

  // -- Expanded --
  const btnClass = [
    "relative group flex items-center justify-start gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 w-full overflow-hidden",
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
          <span className="text-[13px] font-semibold flex-1 text-left whitespace-nowrap truncate">
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
          <span className="text-[13px] font-semibold flex-1 text-left whitespace-nowrap truncate">
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
            <div className="relative mt-0.5 ml-15 py-0.5 space-y-3">
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
                    <span
                      className={[
                        "text-[13px] leading-tight tracking-tight",
                        "transition-all duration-150",
                        isSubActive
                          ? "text-primary font-semibold"
                          : "text-base-content/60 group-hover:text-base-content",
                      ].join(" ")}
                    >
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

  // -- Collapsed --
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

  // -- Expanded --
  return (
    <button
      onClick={onClick}
      className={[
        "relative group flex items-center justify-start gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 w-full overflow-hidden",
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
      <span className="text-[13px] font-semibold flex-1 text-left whitespace-nowrap truncate">
        {label}
      </span>
    </button>
  );
};

// --- Section label (expanded) / spacing (collapsed) --------------------------
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
    return <div className="my-2" />;
  }
  return (
    <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-base-content/30 px-3 pt-5 pb-1 select-none">
      {label}
    </p>
  );
};

const getThemeFromSession = (session: SidebarSession | null): SidebarTheme => {
  return session?.user?.darkMode === true ? "dim" : "winter";
};

// ─── Nav config ───────────────────────────────────────────────────────────────
const caseNavItems: NavItem[] = [
  {
    icon: <FiFileText />,
    href: "cases",
    label: "Case Management",
    dropdowns: [
      { label: "Criminal Cases", href: "criminal" },
      { label: "Civil Cases", href: "civil" },
      { label: "Petition", href: "petition" },
      { label: "Special Proceedings", href: "proceedings" },
      { label: "Receiving Logs", href: "receiving" },
      { label: "Sheriff", href: "sheriff" },
      { label: "Diversion", href: "diversion" },
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

  {
    icon: <FiBarChart2 />,
    href: "statistics",
    label: "Admin Statistics",
    dropdowns: [
      { label: "Monthly Reports", href: "monthly" },
      { label: "Annual Reports", href: "annual" },
      { label: "Judgment Day", href: "judgement" },
      { label: "Summary", href: "summary" },
    ],
  },
];

// Backwards-compatible aliases used across the file
const caseManagementNavItem: NavItem = caseNavItems[0];
const statisticsNavItem: NavItem = caseNavItems[1];
const adminStatisticsNavItem: NavItem = caseNavItems[2];
const archiveOnlyNavItem: NavItem = {
  icon: <FiFileText />,
  href: "cases/archive",
  label: "Archive Explorer",
};
const notarialOnlyNavItem: NavItem = {
  icon: <FiFileText />,
  href: "cases/notarial",
  label: "Notarial",
};
const notarialCommissionNavItem: NavItem = {
  icon: <FiFileText />,
  href: "notarial-commission",
  label: "Notarial Commission",
};

const adminNavItems: NavItem[] = [
  notarialCommissionNavItem,
  { icon: <FiUsers />, href: "employees", label: "Employees" },
  { icon: <FaUserCog />, href: "account", label: "Account" },
  { icon: <FaHistory />, href: "activity-reports", label: "Activity Logs" },
];

interface SidebarMenuProps {
  isExpanded: boolean;
  activeView: string;
  openDropdown: string | null;
  setOpenDropdown: (val: string | null) => void;
  onExpandSidebar: () => void;
  theme: "winter" | "dim";
  onToggleTheme: () => void;
  onOpenMessages: () => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
}

function adminSidebar({
  isExpanded,
  activeView,
  openDropdown,
  setOpenDropdown,
  onExpandSidebar,
  theme,
  onToggleTheme,
  onOpenMessages,
  onOpenNotifications,
  onOpenSettings,
}: SidebarMenuProps) {
  return (
    <>
      {/* Main */}
      <div className="sidebar-stagger" style={{ animationDelay: "0ms" }}>
        <SectionLabel label="Main" isExpanded={isExpanded} isFirst />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "30ms" }}>
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
          onExpandSidebar={onExpandSidebar}
        />
      </div>

      {/* Cases */}
      <div className="sidebar-stagger" style={{ animationDelay: "60ms" }}>
        <SectionLabel label="Cases" isExpanded={isExpanded} />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "90ms" }}>
        <NavBtn
          item={caseManagementNavItem}
          isExpanded={isExpanded}
          activeView={activeView}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
          onExpandSidebar={onExpandSidebar}
        />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "120ms" }}>
        <NavBtn
          item={archiveOnlyNavItem}
          isExpanded={isExpanded}
          activeView={activeView}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
          onExpandSidebar={onExpandSidebar}
        />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "150ms" }}>
        <NavBtn
          item={notarialOnlyNavItem}
          isExpanded={isExpanded}
          activeView={activeView}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
          onExpandSidebar={onExpandSidebar}
        />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "180ms" }}>
        <NavBtn
          item={adminStatisticsNavItem}
          isExpanded={isExpanded}
          activeView={activeView}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
          onExpandSidebar={onExpandSidebar}
        />
      </div>

      {/* Admin */}
      <div className="sidebar-stagger" style={{ animationDelay: "210ms" }}>
        <SectionLabel label="Admin" isExpanded={isExpanded} />
      </div>
      {adminNavItems.map((item, i) => (
        <div
          key={item.href}
          className="sidebar-stagger"
          style={{ animationDelay: `${240 + i * 30}ms` }}
        >
          <NavBtn
            item={item}
            isExpanded={isExpanded}
            activeView={activeView}
            openDropdown={openDropdown}
            setOpenDropdown={setOpenDropdown}
            onExpandSidebar={onExpandSidebar}
          />
        </div>
      ))}

      {/* Communication */}
      <div className="sidebar-stagger" style={{ animationDelay: "360ms" }}>
        <SectionLabel label="Communication" isExpanded={isExpanded} />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "390ms" }}>
        <ActionBtn
          icon={<FiMessageSquare />}
          label="Messages"
          // badge={3}
          isExpanded={isExpanded}
          onClick={onOpenMessages}
        />
      </div>

      {/* Settings */}
      <div className="sidebar-stagger" style={{ animationDelay: "450ms" }}>
        <SectionLabel label="Settings" isExpanded={isExpanded} />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "480ms" }}>
        <ActionBtn
          icon={<FiSettings />}
          label="Settings"
          isExpanded={isExpanded}
          onClick={onOpenSettings}
        />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "510ms" }}>
        <ActionBtn
          icon={theme === "winter" ? <FiMoon /> : <FiSun />}
          label={theme === "winter" ? "Dark Mode" : "Light Mode"}
          isExpanded={isExpanded}
          onClick={onToggleTheme}
        />
      </div>
    </>
  );
}

function criminalSidebar({
  isExpanded,
  activeView,
  openDropdown,
  setOpenDropdown,
  onExpandSidebar,
  theme,
  onToggleTheme,
  onOpenMessages,
  onOpenNotifications,
  onOpenSettings,
}: SidebarMenuProps) {
  return (
    <>
      {/* Main */}
      <div className="sidebar-stagger" style={{ animationDelay: "0ms" }}>
        <SectionLabel label="Main" isExpanded={isExpanded} isFirst />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "30ms" }}>
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
          onExpandSidebar={onExpandSidebar}
        />
      </div>

      {/* Cases */}
      <div className="sidebar-stagger" style={{ animationDelay: "60ms" }}>
        <SectionLabel label="Cases" isExpanded={isExpanded} />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "90ms" }}>
        <NavBtn
          item={caseManagementNavItem}
          isExpanded={isExpanded}
          activeView={activeView}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
          onExpandSidebar={onExpandSidebar}
        />
      </div>

      {/* Communication */}
      <div className="sidebar-stagger" style={{ animationDelay: "120ms" }}>
        <SectionLabel label="Communication" isExpanded={isExpanded} />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "150ms" }}>
        <ActionBtn
          icon={<FiMessageSquare />}
          label="Messages"
          // badge={3}
          isExpanded={isExpanded}
          onClick={onOpenMessages}
        />
      </div>
      {/*    <div className="sidebar-stagger" style={{ animationDelay: "270ms" }}>
          <ActionBtn
            icon={<FiBell />}
            label="Notifications"
            badge={5}
            isExpanded={isExpanded}
            onClick={onOpenNotifications}
          />
        </div> */}

      {/* Settings */}
      <div className="sidebar-stagger" style={{ animationDelay: "210ms" }}>
        <SectionLabel label="Settings" isExpanded={isExpanded} />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "240ms" }}>
        <ActionBtn
          icon={<FiSettings />}
          label="Settings"
          isExpanded={isExpanded}
          onClick={onOpenSettings}
        />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "270ms" }}>
        <ActionBtn
          icon={theme === "winter" ? <FiMoon /> : <FiSun />}
          label={theme === "winter" ? "Dark Mode" : "Light Mode"}
          isExpanded={isExpanded}
          onClick={onToggleTheme}
        />
      </div>
    </>
  );
}
function statsSidebar({
  isExpanded,
  activeView,
  openDropdown,
  setOpenDropdown,
  onExpandSidebar,
  theme,
  onToggleTheme,
  onOpenMessages,
  onOpenNotifications,
  onOpenSettings,
}: SidebarMenuProps) {
  return (
    <>
      {/* Main */}
      <div className="sidebar-stagger" style={{ animationDelay: "0ms" }}>
        <SectionLabel label="Main" isExpanded={isExpanded} isFirst />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "30ms" }}>
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
          onExpandSidebar={onExpandSidebar}
        />
      </div>

      {/* Cases */}
      <div className="sidebar-stagger" style={{ animationDelay: "60ms" }}>
        <SectionLabel label="Cases" isExpanded={isExpanded} />
      </div>

      <div className="sidebar-stagger" style={{ animationDelay: "120ms" }}>
        <NavBtn
          item={statisticsNavItem}
          isExpanded={isExpanded}
          activeView={activeView}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
          onExpandSidebar={onExpandSidebar}
        />
      </div>

      {/* Communication */}
      <div className="sidebar-stagger" style={{ animationDelay: "210ms" }}>
        <SectionLabel label="Communication" isExpanded={isExpanded} />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "240ms" }}>
        <ActionBtn
          icon={<FiMessageSquare />}
          label="Messages"
          // badge={3}
          isExpanded={isExpanded}
          onClick={onOpenMessages}
        />
      </div>
      {/*    <div className="sidebar-stagger" style={{ animationDelay: "270ms" }}>
          <ActionBtn
            icon={<FiBell />}
            label="Notifications"
            badge={5}
            isExpanded={isExpanded}
            onClick={onOpenNotifications}
          />
        </div> */}

      {/* Settings */}
      <div className="sidebar-stagger" style={{ animationDelay: "300ms" }}>
        <SectionLabel label="Settings" isExpanded={isExpanded} />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "330ms" }}>
        <ActionBtn
          icon={<FiSettings />}
          label="Settings"
          isExpanded={isExpanded}
          onClick={onOpenSettings}
        />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "360ms" }}>
        <ActionBtn
          icon={theme === "winter" ? <FiMoon /> : <FiSun />}
          label={theme === "winter" ? "Dark Mode" : "Light Mode"}
          isExpanded={isExpanded}
          onClick={onToggleTheme}
        />
      </div>
    </>
  );
}

function staffSidebar({
  isExpanded,
  activeView,
  openDropdown,
  setOpenDropdown,
  onExpandSidebar,
  theme,
  onToggleTheme,
  onOpenMessages,
  onOpenNotifications,
  onOpenSettings,
}: SidebarMenuProps) {
  return (
    <>
      {/* Main */}
      <div className="sidebar-stagger" style={{ animationDelay: "0ms" }}>
        <SectionLabel label="Main" isExpanded={isExpanded} isFirst />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "30ms" }}>
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
          onExpandSidebar={onExpandSidebar}
        />
      </div>

      {/* Cases */}
      <div className="sidebar-stagger" style={{ animationDelay: "60ms" }}>
        <SectionLabel label="Cases" isExpanded={isExpanded} />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "90ms" }}>
        <NavBtn
          item={caseManagementNavItem}
          isExpanded={isExpanded}
          activeView={activeView}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
          onExpandSidebar={onExpandSidebar}
        />
      </div>
      {/* <div className="sidebar-stagger" style={{ animationDelay: "120ms" }}>
        <NavBtn
          item={caseNavItems[1]}
          isExpanded={isExpanded}
          activeView={activeView}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
          onExpandSidebar={onExpandSidebar}
        />
      </div> */}

      {/* Communication */}
      <div className="sidebar-stagger" style={{ animationDelay: "210ms" }}>
        <SectionLabel label="Communication" isExpanded={isExpanded} />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "240ms" }}>
        <ActionBtn
          icon={<FiMessageSquare />}
          label="Messages"
          // badge={3}
          isExpanded={isExpanded}
          onClick={onOpenMessages}
        />
      </div>
      {/*    <div className="sidebar-stagger" style={{ animationDelay: "270ms" }}>
          <ActionBtn
            icon={<FiBell />}
            label="Notifications"
            badge={5}
            isExpanded={isExpanded}
            onClick={onOpenNotifications}
          />
        </div> */}

      {/* Settings */}
      <div className="sidebar-stagger" style={{ animationDelay: "300ms" }}>
        <SectionLabel label="Settings" isExpanded={isExpanded} />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "330ms" }}>
        <ActionBtn
          icon={<FiSettings />}
          label="Settings"
          isExpanded={isExpanded}
          onClick={onOpenSettings}
        />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "360ms" }}>
        <ActionBtn
          icon={theme === "winter" ? <FiMoon /> : <FiSun />}
          label={theme === "winter" ? "Dark Mode" : "Light Mode"}
          isExpanded={isExpanded}
          onClick={onToggleTheme}
        />
      </div>
    </>
  );
}

function archiveSidebar({
  isExpanded,
  activeView,
  openDropdown,
  setOpenDropdown,
  onExpandSidebar,
  theme,
  onToggleTheme,
  onOpenMessages,
  onOpenNotifications,
  onOpenSettings,
}: SidebarMenuProps) {
  return (
    <>
      {/* Main */}
      <div className="sidebar-stagger" style={{ animationDelay: "0ms" }}>
        <SectionLabel label="Main" isExpanded={isExpanded} isFirst />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "30ms" }}>
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
          onExpandSidebar={onExpandSidebar}
        />
      </div>

      {/* Cases */}
      <div className="sidebar-stagger" style={{ animationDelay: "60ms" }}>
        <SectionLabel label="Cases" isExpanded={isExpanded} />
      </div>

      <div className="sidebar-stagger" style={{ animationDelay: "120ms" }}>
        <NavBtn
          item={archiveOnlyNavItem}
          isExpanded={isExpanded}
          activeView={activeView}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
          onExpandSidebar={onExpandSidebar}
        />
      </div>

      {/* Communication */}
      <div className="sidebar-stagger" style={{ animationDelay: "210ms" }}>
        <SectionLabel label="Communication" isExpanded={isExpanded} />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "240ms" }}>
        <ActionBtn
          icon={<FiMessageSquare />}
          label="Messages"
          // badge={3}
          isExpanded={isExpanded}
          onClick={onOpenMessages}
        />

        {/*    <div className="sidebar-stagger" style={{ animationDelay: "270ms" }}>
          <ActionBtn
            icon={<FiBell />}
            label="Notifications"
            badge={5}
            isExpanded={isExpanded}
            onClick={onOpenNotifications}
          />
        </div> */}
      </div>

      {/* Settings */}
      <div className="sidebar-stagger" style={{ animationDelay: "300ms" }}>
        <SectionLabel label="Settings" isExpanded={isExpanded} />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "330ms" }}>
        <ActionBtn
          icon={<FiSettings />}
          label="Settings"
          isExpanded={isExpanded}
          onClick={onOpenSettings}
        />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "360ms" }}>
        <ActionBtn
          icon={theme === "winter" ? <FiMoon /> : <FiSun />}
          label={theme === "winter" ? "Dark Mode" : "Light Mode"}
          isExpanded={isExpanded}
          onClick={onToggleTheme}
        />
      </div>
    </>
  );
}

function notarialSidebar({
  isExpanded,
  activeView,
  openDropdown,
  setOpenDropdown,
  onExpandSidebar,
  theme,
  onToggleTheme,
  onOpenMessages,
  onOpenNotifications,
  onOpenSettings,
}: SidebarMenuProps) {
  return (
    <>
      {/* Main */}
      <div className="sidebar-stagger" style={{ animationDelay: "0ms" }}>
        <SectionLabel label="Main" isExpanded={isExpanded} isFirst />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "30ms" }}>
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
          onExpandSidebar={onExpandSidebar}
        />
      </div>

      {/* Cases */}
      <div className="sidebar-stagger" style={{ animationDelay: "60ms" }}>
        <SectionLabel label="Cases" isExpanded={isExpanded} />
      </div>

      <div className="sidebar-stagger" style={{ animationDelay: "90ms" }}>
        <NavBtn
          item={notarialOnlyNavItem}
          isExpanded={isExpanded}
          activeView={activeView}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
          onExpandSidebar={onExpandSidebar}
        />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "120ms" }}>
        <NavBtn
          item={notarialCommissionNavItem}
          isExpanded={isExpanded}
          activeView={activeView}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
          onExpandSidebar={onExpandSidebar}
        />
      </div>
      {/* <div className="sidebar-stagger" style={{ animationDelay: "120ms" }}>
        <NavBtn
          item={archiveOnlyNavItem}
          isExpanded={isExpanded}
          activeView={activeView}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
          onExpandSidebar={onExpandSidebar}
        />
      </div> */}

      {/* Communication */}
      <div className="sidebar-stagger" style={{ animationDelay: "240ms" }}>
        <SectionLabel label="Communication" isExpanded={isExpanded} />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "270ms" }}>
        <ActionBtn
          icon={<FiMessageSquare />}
          label="Messages"
          // badge={3}
          isExpanded={isExpanded}
          onClick={onOpenMessages}
        />
      </div>

      {/*    <div className="sidebar-stagger" style={{ animationDelay: "270ms" }}>
          <ActionBtn
            icon={<FiBell />}
            label="Notifications"
            badge={5}
            isExpanded={isExpanded}
            onClick={onOpenNotifications}
          />
        </div> */}

      {/* Settings */}
      <div className="sidebar-stagger" style={{ animationDelay: "330ms" }}>
        <SectionLabel label="Settings" isExpanded={isExpanded} />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "360ms" }}>
        <ActionBtn
          icon={<FiSettings />}
          label="Settings"
          isExpanded={isExpanded}
          onClick={onOpenSettings}
        />
      </div>
      <div className="sidebar-stagger" style={{ animationDelay: "390ms" }}>
        <ActionBtn
          icon={theme === "winter" ? <FiMoon /> : <FiSun />}
          label={theme === "winter" ? "Dark Mode" : "Light Mode"}
          isExpanded={isExpanded}
          onClick={onToggleTheme}
        />
      </div>
    </>
  );
}

// --- User card with tooltip ---------------------------------------------------
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

const isThemeUpdateFailure = (result: SidebarThemeUpdateResult): boolean => {
  if (typeof result === "boolean") {
    return result === false;
  }

  if (result && typeof result === "object" && "success" in result) {
    return result.success === false;
  }

  return false;
};

// --- Sidebar ------------------------------------------------------------------
const Sidebar: React.FC<SidebarProps> = ({
  children,
  session: providedSession,
  sessionState,
  onSignOut,
  updateDarkMode,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const session: SidebarSession | null =
    providedSession ?? sessionState?.data ?? null;
  const activeView = pathname.split("/")[2] || "";

  const [theme, setTheme] = useState<SidebarTheme>(() =>
    getThemeFromSession(session),
  );
  const [collapsed, setCollapsed] = useState(false);
  const isExpanded = !collapsed;
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  useEffect(() => {
    const nextTheme = getThemeFromSession(session);
    setTheme(nextTheme);

    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", nextTheme);
    }
  }, [session]);

  async function updateTheme(newTheme: SidebarTheme) {
    if (updateDarkMode) {
      const result = await updateDarkMode(newTheme);
      if (isThemeUpdateFailure(result)) {
        return;
      }
    }

    setTheme(newTheme);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", newTheme);
    }
  }

  async function handleLogout() {
    try {
      if (onSignOut) {
        await onSignOut();
      }
    } finally {
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-theme", "winter");
      }
      router.push("/");
    }
  }

  const role = session?.user?.role;
  const normalizedRole = (role || "").toLowerCase();
  const menuProps: SidebarMenuProps = {
    isExpanded,
    activeView,
    openDropdown,
    setOpenDropdown,
    onExpandSidebar: () => setCollapsed(false),
    theme,
    onToggleTheme: () => updateTheme(theme === "winter" ? "dim" : "winter"),
    onOpenMessages: () => router.push("/user/messages"),
    onOpenNotifications: () => router.push("/user/notifications"),
    onOpenSettings: () => router.push("/user/settings"),
  };

  return (
    <div className="flex min-h-screen bg-base-100">
      {/* -------------------- SIDEBAR -------------------- */}
      <motion.aside
        animate={{ width: isExpanded ? 264 : 72 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="sticky top-0 h-screen flex flex-col shrink-0 z-30 overflow-hidden sidebar-gradient"
      >
        {/* Animated accent glow at top */}
        <div className="absolute top-0 left-0 right-0 h-40 bg-linear-to-b from-primary/6 to-transparent z-0 pointer-events-none" />
        {/* Subtle right edge */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-linear-to-b from-base-300/20 via-base-300/50 to-base-300/20 z-20" />

        {/* -- Header ------------------------------------ */}
        <div
          className={[
            "flex flex-col items-center transition-all duration-300 relative z-10",
            isExpanded ? "px-5 pt-6 pb-5" : "px-0 pt-5 pb-4",
          ].join(" ")}
        >
          {/* Logo � centered & large in both states */}
          <motion.div
            animate={{
              width: isExpanded ? 72 : 44,
              height: isExpanded ? 72 : 44,
            }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="shrink-0 flex items-center justify-center"
          >
            <Image
              src="/SupremeCourtLogo.webp"
              alt="Supreme Court"
              width={72}
              height={72}
              className="object-contain drop-shadow-md"
            />
          </motion.div>

          {/* Brand text � below logo when expanded */}
          <AnimatePresence mode="wait">
            {isExpanded && (
              <motion.div
                key="brand"
                initial={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -4, filter: "blur(4px)" }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="text-center mt-3"
              >
                <p className="text-[20px] font-extrabold text-base-content/85 leading-tight tracking-tight">
                  Regional Trial Court
                </p>
                <p className="text-[13px] font-medium text-base-content/35 mt-0.5 tracking-wide">
                  Case & Employee System
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="px-2.5 pb-2 relative z-10">
          <motion.button
            onClick={() => setCollapsed((c) => !c)}
            whileHover={{ scale: 1.03, backgroundColor: "rgba(0,0,0,0.06)" }}
            whileTap={{ scale: 0.96 }}
            className={[
              "flex items-center w-full rounded-xl transition-all duration-200 group",
              "bg-base-content/3 hover:bg-base-content/7 text-center",
              isExpanded ? "gap-2.5 px-3 py-2" : "justify-center py-2",
            ].join(" ")}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <motion.span
              animate={{ rotate: collapsed ? 0 : 0 }}
              className="text-base-content/35 group-hover:text-primary/70 transition-colors duration-200"
            >
              {collapsed ? (
                <FiChevronsRight size={16} />
              ) : (
                <FiChevronsLeft size={16} />
              )}
            </motion.span>
            <AnimatePresence mode="wait">
              {isExpanded && (
                <motion.span
                  key="collapse-label"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="text-[11px] text-center font-semibold text-base-content/35 group-hover:text-primary/70 whitespace-nowrap overflow-hidden transition-colors duration-200"
                >
                  Collapse
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
        {/* -- Nav --------------------------------------- */}
        <nav
          className={[
            "flex-1 overflow-y-auto relative z-10",
            isExpanded
              ? "px-2.5 py-1 space-y-0.5 overflow-x-hidden"
              : "px-1.5 py-2 space-y-1 overflow-x-visible",
          ].join(" ")}
        >
          {normalizedRole === "admin"
            ? adminSidebar(menuProps)
            : normalizedRole === "criminal" ||
                normalizedRole === "atty" ||
                normalizedRole === "attorney"
              ? criminalSidebar(menuProps)
              : normalizedRole === "statistics" || normalizedRole === "stats"
                ? statsSidebar(menuProps)
                : normalizedRole === "archive" || normalizedRole === "archives"
                  ? archiveSidebar(menuProps)
                  : normalizedRole === "notarial"
                    ? notarialSidebar(menuProps)
                    : normalizedRole === "user" || normalizedRole === "staff"
                      ? staffSidebar(menuProps)
                      : staffSidebar(menuProps)}
        </nav>

        {/* -- Collapse toggle -------------------------- */}

        {/* -- Footer / User ---------------------------- */}
        <div
          className="p-2 space-y-1 text-left relative z-10"
          style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}
        >
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

      {/* -------------------- MAIN CONTENT -------------------- */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <main className="min-h-screen p-6 lg:p-12 animate-fadeIn">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Sidebar;
