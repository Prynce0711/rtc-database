"use client";

import { authClient, useSession } from "@/app/lib/authClient";
import { motion } from "framer-motion";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import React, { ReactNode, useEffect, useState } from "react";
import { FaHistory, FaUserCog } from "react-icons/fa";
import {
  FiFileText,
  FiHome,
  FiLogOut,
  FiMoon,
  FiSun,
  FiUsers,
} from "react-icons/fi";
import SidebarButton from "./SidebarButton";

interface SidebarProps {
  children: ReactNode;
}

const Sidebar: React.FC<SidebarProps> = ({ children }) => {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const activeView = pathname.split("/")[2] || "dashboard";

  /* ================= THEME ================= */
  const [theme, setTheme] = useState<"winter" | "dim">("winter");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  async function handleLogout() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => router.push("/"),
      },
    });
  }

  const role = session?.user?.role;

  return (
    <div className="drawer lg:drawer-open bg-base-100">
      <input id="app-drawer" type="checkbox" className="drawer-toggle" />

      {/* ================= CONTENT ================= */}
      <div className="drawer-content min-h-screen">
        <motion.main
          key={activeView}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="min-h-screen p-6 lg:p-12"
        >
          {children}
        </motion.main>
      </div>

      {/* ================= SIDEBAR ================= */}
      {/* ================= SIDEBAR ================= */}
      <div className="drawer-side">
        <label htmlFor="app-drawer" className="drawer-overlay" />
        <aside className="w-72 bg-base-200 min-h-full flex flex-col border-r border-base-300">
          {/* ===== LOGO / BRAND ===== */}
          {/* ===== LOGO / BRAND ===== */}
          <div className="px-6 py-8 border-b border-base-300 flex flex-col items-center text-center">
            <Image
              src="/SupremeCourtLogo.webp"
              alt="Supreme Court"
              width={90}
              height={90}
              className="w-23 h-23 object-contain mb-3 "
            />

            <h1 className="text-xl font-extrabold text-base-content leading-tight">
              Regional Trial Court
            </h1>

            <p className="text-sm font-medium text-base-content/60 mt-2">
              Case & Employee System
            </p>
          </div>
          {/* ===== NAV ===== */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {role === "admin"
              ? adminSidebar(activeView)
              : role === "attorney"
                ? attySidebar(activeView)
                : staffSidebar(activeView)}
          </nav>

          {/* ===== FOOTER ===== */}
          <div className="border-t border-base-300 p-4 space-y-2">
            {/* USER PILL */}
            {session?.user && (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-base-100 border border-base-300">
                <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">
                    {session.user.name?.charAt(0).toUpperCase() ?? "U"}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {session.user.name}
                  </p>
                  <p className="text-xs text-base-content/50 capitalize">
                    {session.user.role}
                  </p>
                </div>
              </div>
            )}

            {/* THEME */}
            <button
              onClick={() =>
                setTheme((t) => (t === "winter" ? "dim" : "winter"))
              }
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-base-300 transition"
            >
              {theme === "winter" ? <FiMoon /> : <FiSun />}
              <span className="text-sm font-medium">
                {theme === "winter" ? "Dark Mode" : "Light Mode"}
              </span>
            </button>

            {/* LOGOUT */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-error hover:bg-error/10 transition"
            >
              <FiLogOut />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

/* ================= ROLE NAVS ================= */

function adminSidebar(activeView: string) {
  return (
    <>
      <SidebarButton
        icon={<FiHome />}
        href="dashboard"
        active={activeView}
        label="Dashboard"
      />
      <SidebarButton
        icon={<FiFileText />}
        href="cases"
        active={activeView}
        label="Case Management"
        dropdowns={[
          { label: "Cases", href: "" },
          { label: "Petition", href: "petition" },

          { label: "Special Proceedings", href: "proceedings" },
        ]}
      />
      <SidebarButton
        icon={<FiUsers />}
        href="employees"
        active={activeView}
        label="Employees"
      />
      <SidebarButton
        icon={<FaUserCog />}
        href="account"
        active={activeView}
        label="Account"
      />
      <SidebarButton
        icon={<FaHistory />}
        href="activity-reports"
        active={activeView}
        label="Activity Logs"
      />
    </>
  );
}

function attySidebar(activeView: string) {
  return (
    <>
      <SidebarButton
        icon={<FiHome />}
        href="dashboard"
        active={activeView}
        label="Dashboard"
      />
      <SidebarButton
        icon={<FiFileText />}
        href="cases"
        active={activeView}
        label="Cases"
      />
    </>
  );
}

function staffSidebar(activeView: string) {
  return (
    <>
      <SidebarButton
        icon={<FiHome />}
        href="dashboard"
        active={activeView}
        label="Dashboard"
      />
      <SidebarButton
        icon={<FiFileText />}
        href="cases"
        active={activeView}
        label="Cases"
      />
    </>
  );
}

export default Sidebar;
