"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { FiEye, FiEyeOff, FiInfo } from "react-icons/fi";
import { usePopup } from "@rtc-database/shared";
import {
  getGarageInfo,
  getSystemSettings,
  updateSystemSettings,
} from "../SettingsActions";
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
  const [garageHost, setGarageHost] = useState("localhost");
  const [garagePort, setGaragePort] = useState("3900");
  const [garageAdminPort, setGarageAdminPort] = useState("3903");
  const [garageIsHttps, setGarageIsHttps] = useState(false);
  const [garageAccessKey, setGarageAccessKey] = useState("");
  const [garageSecretKey, setGarageSecretKey] = useState("");
  const [showGarageSecretKey, setShowGarageSecretKey] = useState(false);
  const [garageBucket, setGarageBucket] = useState("");
  const [garageRegion, setGarageRegion] = useState("garage");
  const [garageAdminToken, setGarageAdminToken] = useState("");
  const [showGarageAdminToken, setShowGarageAdminToken] = useState(false);
  const [garageMetricsToken, setGarageMetricsToken] = useState("");
  const [showGarageMetricsToken, setShowGarageMetricsToken] = useState(false);
  const [garageInfoLoading, setGarageInfoLoading] = useState(false);
  const [garageInfoError, setGarageInfoError] = useState<string | null>(null);
  const [garageInfo, setGarageInfo] = useState<{
    totalBytes: number;
    remainingBytes: number;
    consumedBytes: number;
    fetchedAt: string;
  } | null>(null);

  const formatBytes = (value: number): string => {
    if (!Number.isFinite(value) || value < 0) {
      return "0 B";
    }

    const units = ["B", "KB", "MB", "GB", "TB", "PB"];
    let size = value;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }

    return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
  };

  const loadGarageInfo = async () => {
    setGarageInfoLoading(true);
    setGarageInfoError(null);
    if (!garageBucket || !garageBucket.trim()) {
      setGarageInfo(null);
      setGarageInfoError(
        "No Garage bucket selected. Select a bucket to view metrics.",
      );
      setGarageInfoLoading(false);
      return;
    }

    const result = await getGarageInfo(garageBucket.trim());
    if (!result.success) {
      setGarageInfo(null);
      setGarageInfoError(result.error || "Failed to load Garage metrics");
      setGarageInfoLoading(false);
      return;
    }

    setGarageInfo(result.result);
    setGarageInfoLoading(false);
  };

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
      setGarageHost(settings.garageHost ?? "localhost");
      setGaragePort(settings.garagePort ? String(settings.garagePort) : "3900");
      setGarageAdminPort(
        settings.garageAdminPort ? String(settings.garageAdminPort) : "3903",
      );
      setGarageIsHttps(settings.garageIsHttps);
      setGarageAccessKey(settings.garageAccessKey ?? "");
      setGarageSecretKey(settings.garageSecretKey ?? "");
      setGarageBucket(settings.garageBucket ?? "");
      setGarageRegion(settings.garageRegion ?? "garage");
      setGarageAdminToken(settings.garageAdminToken ?? "");
      setGarageMetricsToken(settings.garageMetricsToken ?? "");
      void loadGarageInfo();
      setLoading(false);
    };

    void load();
  }, [popup]);

  const handleSave = async () => {
    const parsedSmtpPort = smtpPort.trim() === "" ? null : Number(smtpPort);
    if (
      parsedSmtpPort !== null &&
      (!Number.isInteger(parsedSmtpPort) || parsedSmtpPort < 1)
    ) {
      popup.showError("SMTP port must be a valid positive integer.");
      return;
    }

    const parsedGaragePort =
      garagePort.trim() === "" ? null : Number(garagePort);
    if (
      parsedGaragePort !== null &&
      (!Number.isInteger(parsedGaragePort) || parsedGaragePort < 1)
    ) {
      popup.showError("Garage port must be a valid positive integer.");
      return;
    }

    const parsedGarageAdminPort =
      garageAdminPort.trim() === "" ? null : Number(garageAdminPort);
    if (
      parsedGarageAdminPort !== null &&
      (!Number.isInteger(parsedGarageAdminPort) || parsedGarageAdminPort < 1)
    ) {
      popup.showError("Garage admin port must be a valid positive integer.");
      return;
    }

    setSaving(true);
    popup.showLoading("Saving system settings...");

    const result = await updateSystemSettings({
      maintainanceMode: maintenanceMode,
      systemAnnouncement: announceText.trim() || null,
      smtpHost: smtpHost.trim() || null,
      smtpPort: parsedSmtpPort,
      senderName: senderName.trim() || null,
      senderEmail: senderEmail.trim() || null,
      senderPassword: senderPassword === "" ? null : senderPassword,
      garageHost: garageHost.trim() || "localhost",
      garagePort: parsedGaragePort,
      garageAdminPort: parsedGarageAdminPort,
      garageIsHttps: garageIsHttps,
      garageAccessKey: garageAccessKey.trim() || null,
      garageSecretKey: garageSecretKey === "" ? null : garageSecretKey,
      garageBucket: garageBucket.trim() || null,
      garageRegion: garageRegion.trim() || "garage",
      garageAdminToken: garageAdminToken === "" ? null : garageAdminToken,
      garageMetricsToken: garageMetricsToken === "" ? null : garageMetricsToken,
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
        title="Garage Storage (Notarial)"
        description="Configure S3-compatible object storage for notarial documents."
      >
        <SettingsRow
          label="Garage Host"
          description="Hostname or IP address of your Garage server."
        >
          <InputField
            value={garageHost}
            onChange={setGarageHost}
            placeholder="localhost"
          />
        </SettingsRow>
        <SettingsRow
          label="Garage Port"
          description="Network port for Garage API access (default: 3900)."
        >
          <InputField
            value={garagePort}
            onChange={setGaragePort}
            placeholder="3900"
          />
        </SettingsRow>
        <SettingsRow
          label="Garage Admin Port"
          description="Network port for Garage admin API and metrics (default: 3903)."
        >
          <InputField
            value={garageAdminPort}
            onChange={setGarageAdminPort}
            placeholder="3903"
          />
        </SettingsRow>
        <SettingsRow
          label="Use HTTPS"
          description="Enable secure connection to Garage server."
        >
          <Toggle checked={garageIsHttps} onChange={setGarageIsHttps} />
        </SettingsRow>
        <SettingsRow
          label="Access Key"
          description="API access key for authentication with Garage."
        >
          <InputField
            value={garageAccessKey}
            onChange={setGarageAccessKey}
            placeholder="Enter Garage access key"
          />
        </SettingsRow>
        <SettingsRow
          label="Secret Key"
          description="API secret key for authentication with Garage."
        >
          <div className="relative">
            <InputField
              value={garageSecretKey}
              onChange={setGarageSecretKey}
              type={showGarageSecretKey ? "text" : "password"}
              placeholder="Enter Garage secret key"
            />
            <button
              type="button"
              onClick={() => setShowGarageSecretKey((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/25 hover:text-base-content/60 transition-colors"
              aria-label={
                showGarageSecretKey
                  ? "Hide Garage secret key"
                  : "Show Garage secret key"
              }
            >
              {showGarageSecretKey ? (
                <FiEyeOff size={16} />
              ) : (
                <FiEye size={16} />
              )}
            </button>
          </div>
        </SettingsRow>
        <SettingsRow
          label="Bucket Name"
          description="Default bucket for storing notarial documents."
        >
          <InputField
            value={garageBucket}
            onChange={setGarageBucket}
            placeholder="notarial-documents"
          />
        </SettingsRow>
        <SettingsRow
          label="Region"
          description="S3 region label used for Garage and rclone remote configuration (default: garage)."
        >
          <InputField
            value={garageRegion}
            onChange={setGarageRegion}
            placeholder="garage"
          />
        </SettingsRow>
        <SettingsRow
          label="Admin API Token"
          description="Bearer token for Garage admin API calls (ListBuckets/GetBucketInfo)."
        >
          <div className="relative">
            <InputField
              value={garageAdminToken}
              onChange={setGarageAdminToken}
              type={showGarageAdminToken ? "text" : "password"}
              placeholder="Enter Garage admin token"
            />
            <button
              type="button"
              onClick={() => setShowGarageAdminToken((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/25 hover:text-base-content/60 transition-colors"
              aria-label={
                showGarageAdminToken
                  ? "Hide Garage admin token"
                  : "Show Garage admin token"
              }
            >
              {showGarageAdminToken ? (
                <FiEyeOff size={16} />
              ) : (
                <FiEye size={16} />
              )}
            </button>
          </div>
        </SettingsRow>
        <SettingsRow
          label="Metrics Token"
          description="Bearer token for Garage /metrics endpoint (optional if metrics are public)."
        >
          <div className="relative">
            <InputField
              value={garageMetricsToken}
              onChange={setGarageMetricsToken}
              type={showGarageMetricsToken ? "text" : "password"}
              placeholder="Enter Garage metrics token"
            />
            <button
              type="button"
              onClick={() => setShowGarageMetricsToken((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/25 hover:text-base-content/60 transition-colors"
              aria-label={
                showGarageMetricsToken
                  ? "Hide Garage metrics token"
                  : "Show Garage metrics token"
              }
            >
              {showGarageMetricsToken ? (
                <FiEyeOff size={16} />
              ) : (
                <FiEye size={16} />
              )}
            </button>
          </div>
        </SettingsRow>
        <SettingsRow
          label="Storage Info"
          description="Live capacity metrics from Garage monitoring endpoint."
        >
          <div className="w-full rounded-xl border border-base-300 bg-base-100 px-4 py-3">
            {garageInfoLoading ? (
              <p className="text-sm text-base-content/60">
                Loading storage info...
              </p>
            ) : garageInfoError ? (
              <p className="text-sm text-error">{garageInfoError}</p>
            ) : garageInfo ? (
              <div className="space-y-1 text-sm">
                <p className="text-base-content/80">
                  Remaining:{" "}
                  <span className="font-semibold">
                    {formatBytes(garageInfo.remainingBytes)}
                  </span>
                </p>
                <p className="text-base-content/80">
                  Consumed:{" "}
                  <span className="font-semibold">
                    {formatBytes(garageInfo.consumedBytes)}
                  </span>
                </p>
                <p className="text-base-content/80">
                  Total:{" "}
                  <span className="font-semibold">
                    {formatBytes(garageInfo.totalBytes)}
                  </span>
                </p>
                <p className="text-xs text-base-content/40">
                  Last updated:{" "}
                  {new Date(garageInfo.fetchedAt).toLocaleString()}
                </p>
              </div>
            ) : (
              <p className="text-sm text-base-content/60">
                No metrics available.
              </p>
            )}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => {
                  void loadGarageInfo();
                }}
                disabled={garageInfoLoading}
              >
                Refresh
              </button>
            </div>
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
