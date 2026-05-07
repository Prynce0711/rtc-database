"use client";

import Roles from "@/app/lib/Roles";
import React from "react";
import {
  FiBell,
  FiCalendar,
  FiDatabase,
  FiHelpCircle,
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

export const SETTINGS_ROLES = [
  Roles.ADMIN,
  Roles.CRIMINAL,
  Roles.USER,
  Roles.STATISTICS,
  Roles.NOTARIAL,
  Roles.ARCHIVE,
];

export const TABS: TabConfig[] = [
  {
    id: "profile",
    label: "Profile",
    icon: <FiUser size={18} />,
    roles: SETTINGS_ROLES,
  },
  {
    id: "security",
    label: "Security",
    icon: <FiShield size={18} />,
    roles: SETTINGS_ROLES,
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: <FiBell size={18} />,
    roles: SETTINGS_ROLES,
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: <FiMonitor size={18} />,
    roles: SETTINGS_ROLES,
  },
  {
    id: "system",
    label: "System",
    icon: <FiServer size={18} />,
    roles: [Roles.ADMIN],
  },
  {
    id: "backup",
    label: "Backup",
    icon: <FiDatabase size={18} />,
    roles: [Roles.ADMIN],
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: <FiCalendar size={18} />,
    roles: [Roles.CRIMINAL],
  },
  {
    id: "tutorial",
    label: "Tutorial",
    icon: <FiHelpCircle size={18} />,
    roles: SETTINGS_ROLES,
  },
];

