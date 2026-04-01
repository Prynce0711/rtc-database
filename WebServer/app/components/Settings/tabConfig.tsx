"use client";

import Roles from "@/app/lib/Roles";
import React from "react";
import {
  FiBell,
  FiCalendar,
  FiMonitor,
  FiServer,
  FiShield,
  FiUser,
} from "react-icons/fi";

export interface TabConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
}

export const TABS: TabConfig[] = [
  {
    id: "profile",
    label: "Profile",
    icon: <FiUser size={18} />,
    roles: [Roles.ADMIN, Roles.ATTY, Roles.USER],
  },
  {
    id: "security",
    label: "Security",
    icon: <FiShield size={18} />,
    roles: [Roles.ADMIN, Roles.ATTY, Roles.USER],
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: <FiBell size={18} />,
    roles: [Roles.ADMIN, Roles.ATTY, Roles.USER],
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: <FiMonitor size={18} />,
    roles: [Roles.ADMIN, Roles.ATTY, Roles.USER],
  },
  {
    id: "system",
    label: "System",
    icon: <FiServer size={18} />,
    roles: [Roles.ADMIN],
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: <FiCalendar size={18} />,
    roles: [Roles.ATTY],
  },
];
