"use client";

import Roles from "@/app/lib/Roles";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../Dashboard/DashboardLayout";
import SettingsTab from "./SettingsTab";
import { TABS } from "./tabConfig";
import TabContent from "./Tabs/TabContent";
import { useSession } from "@/app/lib/authClient";

const Settings = () => {
  const { data: session } = useSession();
  const role = session?.user?.role ?? Roles.USER;

  const visibleTabs = useMemo(
    () => TABS.filter((tab) => tab.roles.includes(role)),
    [role],
  );

  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.id ?? "profile");

  useEffect(() => {
    if (visibleTabs.length === 0) {
      setActiveTab("profile");
      return;
    }

    const tabExists = visibleTabs.some((tab) => tab.id === activeTab);
    if (!tabExists) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [activeTab, visibleTabs]);

  return (
    <DashboardLayout
      title="Settings"
      subtitle="Manage your preferences and system configuration."
    >
      <div className="flex flex-col lg:flex-row gap-8 mt-4">
        <div className="lg:w-64 shrink-0">
          <SettingsTab
            tabs={visibleTabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          <div className="mt-5 px-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-base-content/20">
              Signed in as
            </p>
            <p className="text-sm font-semibold text-base-content/65 mt-1 capitalize">
              {role === Roles.ADMIN
                ? "Administrator"
                : role === Roles.ATTY
                  ? "Attorney"
                  : "Staff"}
            </p>
          </div>
        </div>

        <div className="flex-1 min-w-0">
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
