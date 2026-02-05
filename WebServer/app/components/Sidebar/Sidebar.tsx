"use client";

import { useSession } from "@/app/lib/authClient";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import React, { ReactNode } from "react";
import { FiHome } from "react-icons/fi";
import { IoPersonCircleOutline } from "react-icons/io5";
import { PiSlidersHorizontal } from "react-icons/pi";
import Header from "./Header";
import SidebarButton from "./SidebarButton";

interface SidebarProps {
  children: ReactNode;
}

const Sidebar: React.FC<SidebarProps> = ({ children }) => {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const pathname = usePathname();
  const rawTitle = pathname.split("/")[2] || "Dashboard";
  const rawTitleWords = rawTitle.split("-").map((word) => capitalizeWord(word));
  const activeView = rawTitleWords.join(" ");

  return (
    <div>
      <div className="drawer lg:drawer-open">
        <input id="my-drawer-4" type="checkbox" className="drawer-toggle" />
        <div className="drawer-content">
          {/* Header */}
          <Header />

          <motion.div
            key={activeView}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.18 }}
            className="min-h-screen w-full"
          >
            {children}
          </motion.div>
        </div>

        <div className="drawer-side is-drawer-close:overflow-visible">
          <label
            htmlFor="my-drawer-4"
            aria-label="close sidebar"
            className="drawer-overlay"
          ></label>
          <div className="flex min-h-full flex-col items-start bg-base-200 is-drawer-close:w-14 is-drawer-open:w-64">
            {/* Sidebar content here */}
            <ul className="menu w-full grow">
              {isAdmin
                ? AdminSidebarContents(activeView)
                : StaffSidebarContents(activeView)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

function AdminSidebarContents(activeView: string) {
  return (
    <>
      <SidebarButton
        icon={<FiHome className="w-5 h-5" />}
        activeView={activeView}
        href="dashboard"
      />
      <SidebarButton
        icon={<PiSlidersHorizontal className="w-5 h-5" />}
        activeView={activeView}
        href="cases"
      />
      <SidebarButton
        icon={<IoPersonCircleOutline className="w-5 h-5" />}
        activeView={activeView}
        href="accounts"
      />
    </>
  );
}

function StaffSidebarContents(activeView: string) {
  return (
    <>
      <SidebarButton
        icon={<FiHome className="w-5 h-5" />}
        activeView={activeView}
        href="dashboard"
      />
      <SidebarButton
        icon={<PiSlidersHorizontal className="w-5 h-5" />}
        activeView={activeView}
        href="cases"
      />
    </>
  );
}

function capitalizeWord(word: string) {
  if (word.length === 2) {
    return word.toUpperCase();
  }

  return word.charAt(0).toUpperCase() + word.slice(1);
}

export default Sidebar;
