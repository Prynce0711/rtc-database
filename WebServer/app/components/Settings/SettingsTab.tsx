"use client";

import { FiChevronRight } from "react-icons/fi";
import { TabConfig } from "./tabConfig";

interface SettingsTabProps {
  tabs: TabConfig[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const SettingsTab = ({ tabs, activeTab, onTabChange }: SettingsTabProps) => {
  return (
    <nav className="bg-base-200/60 rounded-2xl border border-base-300/60 p-2.5 space-y-1 lg:sticky lg:top-8 backdrop-blur-sm">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={[
              "relative flex items-center gap-3.5 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-primary text-primary-content shadow-md"
                : "text-base-content/50 hover:bg-base-300/50 hover:text-base-content",
            ].join(" ")}
          >
            <span className="shrink-0 text-[18px]">{tab.icon}</span>
            <span className="truncate">{tab.label}</span>
            {isActive && (
              <FiChevronRight
                size={15}
                className="ml-auto opacity-50 shrink-0"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
};

export default SettingsTab;
