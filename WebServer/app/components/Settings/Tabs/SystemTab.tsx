"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { FiEye, FiEyeOff, FiInfo } from "react-icons/fi";
import { usePopup } from "../../Popup/PopupProvider";
import { getSystemSettings, updateSystemSettings } from "../SettingsActions";
import {
  InputField,
  SaveButton,
  SelectField,
  SettingsCard,
  SettingsRow,
  Toggle,
} from "../SettingsPrimitives";

const SystemTab = () => {
  const popup = usePopup();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [passwordExpiration, setPasswordExpiration] = useState("NEVER");
  const [lockoutThreshold, setLockoutThreshold] = useState("NONE");
  const [sessionTimeout, setSessionTimeout] = useState("THIRTY_MINUTES");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderPassword, setSenderPassword] = useState("");
  const [showSenderPassword, setShowSenderPassword] = useState(false);
  const [announceText, setAnnounceText] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await getSystemSettings();
      if (!result.success) {
        popup.showError(result.error || "Failed to load system settings");
        setLoading(false);
        return;
      }

      const settings = result.result;
      setMaintenanceMode(settings.maintainanceMode);
      setPasswordExpiration(settings.passwordExpiration);
      setLockoutThreshold(settings.lockoutThreshold);
      setSessionTimeout(settings.sessionTimeout);
      setSmtpHost(settings.smtpHost ?? "");
      setSmtpPort(settings.smtpPort ? String(settings.smtpPort) : "");
      setSenderName(settings.senderName ?? "");
      setSenderEmail(settings.senderEmail ?? "");
      setSenderPassword(settings.senderPassword ?? "");
      setAnnounceText(settings.systemAnnouncement ?? "");
      setLoading(false);
    };

    void load();
  }, [popup]);

  const handleSave = async () => {
    const parsedPort = smtpPort.trim() === "" ? null : Number(smtpPort);
    if (
      parsedPort !== null &&
      (!Number.isInteger(parsedPort) || parsedPort < 1)
    ) {
      popup.showError("SMTP port must be a valid positive integer.");
      return;
    }

    setSaving(true);
    popup.showLoading("Saving system settings...");

    const result = await updateSystemSettings({
      maintainanceMode: maintenanceMode,
      systemAnnouncement: announceText.trim() || null,
      smtpHost: smtpHost.trim() || null,
      smtpPort: parsedPort,
      senderName: senderName.trim() || null,
      senderEmail: senderEmail.trim() || null,
      senderPassword: senderPassword === "" ? null : senderPassword,
      passwordExpiration,
      lockoutThreshold,
      sessionTimeout,
    });

    setSaving(false);
    if (!result.success) {
      popup.showError(result.error || "Failed to save system settings");
      return;
    }

    popup.showSuccess("System settings saved successfully.");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SettingsCard
          title="System Settings"
          description="Loading current configuration..."
        >
          <div className="px-7 py-8 text-sm text-base-content/50">
            Loading...
          </div>
        </SettingsCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsCard
        title="System Status"
        description="Monitor and control system-wide operations."
      >
        <SettingsRow
          label="Maintenance Mode"
          description="Temporarily restrict access. Only admins can sign in."
        >
          <Toggle checked={maintenanceMode} onChange={setMaintenanceMode} />
        </SettingsRow>
        {maintenanceMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="px-7 pb-5"
          >
            <div className="flex items-start gap-4 rounded-xl bg-warning/8 border border-warning/15 p-5">
              <FiInfo size={18} className="text-warning shrink-0 mt-0.5" />
              <p className="text-[13px] text-warning leading-relaxed font-medium">
                Maintenance mode is active. Regular users will see a maintenance
                page and cannot access the system until this is turned off.
              </p>
            </div>
          </motion.div>
        )}
      </SettingsCard>

      <SettingsCard
        title="System Announcement"
        description="Display a banner message to all users."
      >
        <div className="px-7 py-5">
          <textarea
            value={announceText}
            onChange={(e) => setAnnounceText(e.target.value)}
            placeholder="Type a system-wide announcement to display on all pages..."
            rows={3}
            className="textarea textarea-bordered w-full text-sm bg-base-100 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 resize-none rounded-xl placeholder:text-base-content/25"
          />
          <p className="text-[12px] text-base-content/30 mt-2">
            Leave empty to hide the banner.
          </p>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Email Server (SMTP)"
        description="Configure outgoing email for notifications."
      >
        <SettingsRow
          label="SMTP Host"
          description="Hostname of your outgoing mail server (for example: smtp.gmail.com)."
        >
          <InputField
            value={smtpHost}
            onChange={setSmtpHost}
            placeholder="smtp.example.com"
          />
        </SettingsRow>
        <SettingsRow
          label="SMTP Port"
          description="Network port used by your SMTP provider (common: 587 for TLS, 465 for SSL)."
        >
          <InputField
            value={smtpPort}
            onChange={setSmtpPort}
            placeholder="587"
          />
        </SettingsRow>
        <SettingsRow
          label="Sender Name"
          description="Display name recipients see in the From field."
        >
          <InputField
            value={senderName}
            onChange={setSenderName}
            placeholder="RTC Notifications"
          />
        </SettingsRow>
        <SettingsRow
          label="Sender Email"
          description="Email address used as the From address for outgoing notifications."
        >
          <InputField
            value={senderEmail}
            onChange={setSenderEmail}
            placeholder="noreply@court.gov.ph"
          />
        </SettingsRow>
        <SettingsRow
          label="Sender Password"
          description="Authentication password or app password for the sender email account."
        >
          <div className="relative">
            <InputField
              value={senderPassword}
              onChange={setSenderPassword}
              type={showSenderPassword ? "text" : "password"}
              placeholder="Enter sender password"
            />
            <button
              type="button"
              onClick={() => setShowSenderPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/25 hover:text-base-content/60 transition-colors"
              aria-label={
                showSenderPassword
                  ? "Hide sender password"
                  : "Show sender password"
              }
            >
              {showSenderPassword ? (
                <FiEyeOff size={16} />
              ) : (
                <FiEye size={16} />
              )}
            </button>
          </div>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="Security Policies"
        description="Configure password and session policies for user accounts."
      >
        <SettingsRow
          label="Password Expiration"
          description="Force users to rotate passwords."
        >
          <SelectField
            value={passwordExpiration}
            onChange={setPasswordExpiration}
            options={[
              { value: "NEVER", label: "Never" },
              { value: "ONE_MONTH", label: "Every 1 month" },
              { value: "TWO_MONTHS", label: "Every 2 months" },
              { value: "THREE_MONTHS", label: "Every 3 months" },
              { value: "SIX_MONTHS", label: "Every 6 months" },
            ]}
          />
        </SettingsRow>
        <SettingsRow
          label="Account Lockout Threshold"
          description="Lock account after failed sign-in attempts."
        >
          <SelectField
            value={lockoutThreshold}
            onChange={setLockoutThreshold}
            options={[
              { value: "NONE", label: "No lockout" },
              { value: "THREE_ATTEMPTS", label: "3 attempts" },
              { value: "FIVE_ATTEMPTS", label: "5 attempts" },
              { value: "TEN_ATTEMPTS", label: "10 attempts" },
            ]}
          />
        </SettingsRow>
        <SettingsRow
          label="Session Timeout"
          description="Auto-logout period for inactive sessions."
        >
          <SelectField
            value={sessionTimeout}
            onChange={setSessionTimeout}
            options={[
              { value: "FIFTEEN_MINUTES", label: "15 minutes" },
              { value: "THIRTY_MINUTES", label: "30 minutes" },
              { value: "ONE_HOUR", label: "1 hour" },
              { value: "TWO_HOURS", label: "2 hours" },
              { value: "FOUR_HOURS", label: "4 hours" },
              { value: "EIGHT_HOURS", label: "8 hours" },
              { value: "NEVER", label: "Never timeout" },
            ]}
          />
        </SettingsRow>
      </SettingsCard>

      <div className="flex justify-end">
        <SaveButton onClick={saving ? undefined : handleSave} />
      </div>
    </div>
  );
};

export default SystemTab;
