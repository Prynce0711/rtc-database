"use client";

import { authClient, useSession } from "@/app/lib/authClient";
import { motion } from "framer-motion";
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
          className="min-h-screen p-6 lg:p-8"
        >
          {children}
        </motion.main>
      </div>

      {/* ================= SIDEBAR ================= */}
      <div className="drawer-side">
        <label htmlFor="app-drawer" className="drawer-overlay" />

        <aside className="w-72 bg-base-200 min-h-full flex flex-col border-r border-base-300">
          {/* ===== LOGO / BRAND ===== */}
          <div className="px-6 py-6 border-b border-base-300 flex items-center gap-3">
            <img
              src="/SupremeCourtLogo.webp"
              alt="Supreme Court"
              className="w-11 h-11 object-contain"
            />
            <div>
              <h1 className="font-bold text-base-content leading-tight">
                Regional Trial Court
              </h1>
              <p className="text-xs text-base-content/60">
                Case & Employee System
              </p>
            </div>
          </div>

          {/* ===== NAVIGATION ===== */}
          <nav className="flex-1 px-3 py-4 space-y-1">
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
            <SidebarButton
              icon={<FiUsers />}
              href="employees"
              active={activeView}
              label="Employees"
            />

            {session?.user?.role === "admin" && (
              <>
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
            )}
          </nav>

          {/* ===== FOOTER CONTROLS ===== */}
          <div className="border-t border-base-300 p-4 space-y-3">
            {/* THEME TOGGLE */}
            <button
              onClick={() =>
                setTheme((t) => (t === "winter" ? "dim" : "winter"))
              }
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-base-300 transition"
            >
              {theme === "winter" ? (
                <FiMoon className="text-lg" />
              ) : (
                <FiSun className="text-lg" />
              )}
              <span className="text-sm font-medium">
                {theme === "winter" ? "Dark Mode" : "Light Mode"}
              </span>
            </button>

            {/* LOGOUT */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-error hover:bg-error/10 transition"
            >
              <FiLogOut className="text-lg" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Sidebar;
