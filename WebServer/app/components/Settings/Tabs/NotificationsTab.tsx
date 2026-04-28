"use client";

import Roles from "@/app/lib/Roles";
import { useState } from "react";
import {
  SaveButton,
  SelectField,
  SettingsCard,
  SettingsRow,
  Toggle,
} from "../SettingsPrimitives";

const NotificationsTab = ({ role }: { role: string }) => {
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [caseAssignment, setCaseAssignment] = useState(true);
  const [caseUpdates, setCaseUpdates] = useState(true);
  const [deadlineReminders, setDeadlineReminders] = useState(true);
  const [hearingReminders, setHearingReminders] = useState(true);
  const [systemAlerts, setSystemAlerts] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(false);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [reminderLeadTime, setReminderLeadTime] = useState("24");
  const isAdmin = role === Roles.ADMIN;
  const isCriminalSection = role === Roles.CRIMINAL;

  return (
    <div className="space-y-6">
      <SettingsCard
        title="Email Notifications"
        description="Control which emails you receive."
      >
        <SettingsRow
          label="Enable Email Notifications"
          description="Receive important updates via email."
        >
          <Toggle checked={emailNotifs} onChange={setEmailNotifs} />
        </SettingsRow>
        <SettingsRow
          label="Weekly Digest"
          description="Get a summary of activity every Monday."
        >
          <Toggle checked={weeklyDigest} onChange={setWeeklyDigest} />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="Case Notifications"
        description="Stay informed about your cases."
      >
        <SettingsRow
          label="Case Assignment"
          description="Notify me when a new case is assigned."
        >
          <Toggle checked={caseAssignment} onChange={setCaseAssignment} />
        </SettingsRow>
        <SettingsRow
          label="Case Status Updates"
          description="Notify me when case status changes."
        >
          <Toggle checked={caseUpdates} onChange={setCaseUpdates} />
        </SettingsRow>
        <SettingsRow
          label="Deadline Reminders"
          description="Remind me before case deadlines."
        >
          <Toggle checked={deadlineReminders} onChange={setDeadlineReminders} />
        </SettingsRow>
        {(isCriminalSection || isAdmin) && (
          <SettingsRow
            label="Hearing Reminders"
            description="Remind me before scheduled hearings."
          >
            <Toggle checked={hearingReminders} onChange={setHearingReminders} />
          </SettingsRow>
        )}
        {deadlineReminders && (
          <SettingsRow
            label="Reminder Lead Time"
            description="How early to send reminders."
          >
            <SelectField
              value={reminderLeadTime}
              onChange={setReminderLeadTime}
              options={[
                { value: "1", label: "1 hour before" },
                { value: "3", label: "3 hours before" },
                { value: "24", label: "1 day before" },
                { value: "72", label: "3 days before" },
                { value: "168", label: "1 week before" },
              ]}
            />
          </SettingsRow>
        )}
      </SettingsCard>

      <SettingsCard
        title="Security Notifications"
        description="Account activity alerts."
      >
        <SettingsRow
          label="Login Alerts"
          description="Get notified of new sign-ins to your account."
        >
          <Toggle checked={loginAlerts} onChange={setLoginAlerts} />
        </SettingsRow>
        {isAdmin && (
          <SettingsRow
            label="System Alerts"
            description="Receive alerts on system health and errors."
          >
            <Toggle checked={systemAlerts} onChange={setSystemAlerts} />
          </SettingsRow>
        )}
      </SettingsCard>

      <div className="flex justify-end">
        <SaveButton />
      </div>
    </div>
  );
};

export default NotificationsTab;

