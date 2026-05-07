"use client";

import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import { RedirectingUI } from "@rtc-database/shared";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState, useSyncExternalStore } from "react";
import DashboardLayout from "../Dashboard/DashboardLayout";
import SettingsTab from "./SettingsTab";
import { TABS } from "./tabConfig";
import TabContent from "./Tabs/TabContent";

const subscribeToHydration = () => () => {};
const getHydratedSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

const getRoleLabel = (role: string) => {
  switch (role) {
    case Roles.ADMIN:
      return "Administrator";
    case Roles.CRIMINAL:
      return "Criminal Section";
    case Roles.STATISTICS:
      return "Statistics";
    case Roles.NOTARIAL:
      return "Notarial";
    case Roles.ARCHIVE:
      return "Archive";
    default:
      return "Staff";
  }
};

const Settings = () => {
  const session = useSession();
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydrationSnapshot,
  );

  const role = session.data?.user?.role ?? Roles.USER;

  const visibleTabs = useMemo(
    () => TABS.filter((tab) => tab.roles.includes(role)),
    [role],
  );

  const [requestedActiveTab, setRequestedActiveTab] = useState("profile");
  const activeTab = visibleTabs.some((tab) => tab.id === requestedActiveTab)
    ? requestedActiveTab
    : visibleTabs[0]?.id ?? "profile";

  if (!isHydrated || session.isPending) {
    return <RedirectingUI titleText="Loading settings..." />;
  }

  return (
    <DashboardLayout
      title="Settings"
      subtitle="Manage your preferences and system configuration."
    >
      <div className="flex flex-col lg:flex-row gap-8 mt-4">
        <div className="lg:w-64 shrink-0" data-tour="settings-sidebar">
          <SettingsTab
            tabs={visibleTabs}
            activeTab={activeTab}
            onTabChange={setRequestedActiveTab}
          />

          <div className="mt-5 px-4" data-tour="settings-signed-in">
            <p className="text-[11px] font-bold uppercase tracking-widest text-base-content/20">
              Signed in as
            </p>
            <p className="text-sm font-semibold text-base-content/65 mt-1 capitalize">
              {getRoleLabel(role)}
            </p>
          </div>
        </div>

        <div className="flex-1 min-w-0" data-tour="settings-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              <TabContent tabId={activeTab} role={role} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;

