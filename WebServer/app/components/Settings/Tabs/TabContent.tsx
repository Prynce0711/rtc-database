"use client";

import AppearanceTab from "./AppearanceTab";
import BackupTab from "./BackupTab";
import CalendarTab from "./CalendarTab";
import NotificationsTab from "./NotificationsTab";
import ProfileTab from "./ProfileTab";
import SecurityTab from "./SecurityTab";
import SystemTab from "./SystemTab";

const TabContent = ({ tabId, role }: { tabId: string; role: string }) => {
  switch (tabId) {
    case "profile":
      return <ProfileTab role={role} />;
    case "security":
      return <SecurityTab role={role} />;
    case "notifications":
      return <NotificationsTab role={role} />;
    case "appearance":
      return <AppearanceTab />;
    case "system":
      return <SystemTab />;
    case "backup":
      return <BackupTab />;
    case "calendar":
      return <CalendarTab />;
    default:
      return null;
  }
};

export default TabContent;
