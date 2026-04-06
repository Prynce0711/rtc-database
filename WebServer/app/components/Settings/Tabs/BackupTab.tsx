"use client";

import { useEffect, useState } from "react";
import { FiDatabase, FiPlus, FiTrash2, FiXCircle } from "react-icons/fi";
import { usePopup } from "../../Popup/PopupProvider";
import {
  cancelBackupNowAction,
  createBackupAccount,
  deleteBackupAccount,
  getBackupDashboard,
  runBackupNowAction,
  saveBackupConfiguration,
  type BackupDashboardData,
} from "../BackupActions";
import {
  InputField,
  SaveButton,
  SelectField,
  SettingsCard,
  SettingsRow,
  Toggle,
} from "../SettingsPrimitives";

const toLocalDateTimeInput = (iso: string | null): string => {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (value: number) => value.toString().padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const toIsoOrNull = (value: string): string | null => {
  if (!value.trim()) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
};

const BackupTab = () => {
  const popup = usePopup();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);
  const [cancellingBackup, setCancellingBackup] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountSetupInProgress, setAccountSetupInProgress] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState("60");
  const [nextRunAt, setNextRunAt] = useState("");
  const [remoteName, setRemoteName] = useState("");
  const [remotePath, setRemotePath] = useState("rtc-backups");

  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [lastRunStatus, setLastRunStatus] = useState("IDLE");
  const [lastRunMessage, setLastRunMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<BackupDashboardData["logs"]>([]);

  const [intervalOptions, setIntervalOptions] = useState<number[]>([60]);
  const [remotes, setRemotes] = useState<
    Array<{ name: string; provider: string }>
  >([]);
  const [providers, setProviders] = useState<
    Array<{ value: string; label: string; description: string }>
  >([]);

  const [newRemoteName, setNewRemoteName] = useState("");
  const [newProvider, setNewProvider] = useState("drive");
  const [newOptionsJson, setNewOptionsJson] = useState("{}");

  const isAccountAuthConflictError = (message: string): boolean => {
    const lowered = message.toLowerCase();

    return (
      lowered.includes("account authorization is already") ||
      lowered.includes("local callback port") ||
      lowered.includes("failed to start auth webserver")
    );
  };

  const applyDashboardData = (data: BackupDashboardData) => {
    setEnabled(data.config.enabled);
    setIntervalMinutes(String(data.config.intervalMinutes));
    setNextRunAt(toLocalDateTimeInput(data.config.nextRunAt));
    setRemoteName(data.config.remoteName);
    setRemotePath(data.config.remotePath);
    setLastRunAt(data.config.lastRunAt);
    setLastRunStatus(data.config.lastRunStatus);
    setLastRunMessage(data.config.lastRunMessage);
    setLogs(data.logs);
    setRemotes(data.remotes);
    setProviders(data.providers);
    setIntervalOptions(data.intervalOptions);
    setAccountSetupInProgress(data.accountSetupInProgress);
    setNewProvider(data.providers[0]?.value ?? "drive");
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await getBackupDashboard();
      if (!result.success) {
        popup.showError(result.error || "Failed to load backup settings");
        setLoading(false);
        return;
      }

      applyDashboardData(result.result);
      setLoading(false);
    };

    void load();
  }, [popup]);

  const handleSave = async () => {
    if (enabled && !remoteName.trim()) {
      popup.showError(
        "Select a destination account before enabling auto backup.",
      );
      return;
    }

    const nextRunIso = toIsoOrNull(nextRunAt);
    if (nextRunAt.trim() && !nextRunIso) {
      popup.showError("Invalid next backup date/time.");
      return;
    }

    setSaving(true);
    popup.showLoading("Saving backup settings...");

    const result = await saveBackupConfiguration({
      enabled,
      intervalMinutes: Number(intervalMinutes),
      nextRunAt: nextRunIso,
      remoteName: remoteName.trim(),
      remotePath: remotePath.trim(),
    });

    setSaving(false);
    if (!result.success) {
      popup.showError(result.error || "Failed to save backup settings");
      return;
    }

    applyDashboardData(result.result);
    popup.showSuccess("Backup settings saved successfully.");
  };

  const handleRunBackupNow = async () => {
    setRunningBackup(true);
    popup.showLoading("Running backup now...");

    const result = await runBackupNowAction();
    setRunningBackup(false);

    if (!result.success) {
      popup.showError(result.error || "Backup failed");
      return;
    }

    applyDashboardData(result.result);
    popup.showSuccess("Backup completed.");
  };

  const handleCancelBackup = async () => {
    setCancellingBackup(true);
    popup.showLoading("Cancelling backup...");

    const result = await cancelBackupNowAction();
    setCancellingBackup(false);

    if (!result.success) {
      popup.showError(result.error || "Failed to cancel backup");
      return;
    }

    applyDashboardData(result.result);
    popup.showSuccess("Backup cancelled.");
  };

  const handleCreateAccount = async () => {
    let forceRestart = false;

    if (accountSetupInProgress) {
      const confirmed = await popup.showConfirm(
        "Account authorization is already running. Remove the existing sign-in flow and continue?",
      );

      if (!confirmed) {
        return;
      }

      forceRestart = true;
    }

    let options: Record<string, string> = {};

    if (newOptionsJson.trim()) {
      try {
        const parsed = JSON.parse(newOptionsJson) as unknown;
        if (typeof parsed !== "object" || !parsed || Array.isArray(parsed)) {
          popup.showError("Account options must be a JSON object.");
          return;
        }

        options = Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>).map(
            ([key, value]) => [key, String(value)],
          ),
        );
      } catch {
        popup.showError("Invalid options JSON.");
        return;
      }
    }

    if (!newRemoteName.trim()) {
      popup.showError("Account name is required.");
      return;
    }

    const requiresAuthFlow = ["drive", "onedrive", "dropbox"].includes(
      newProvider,
    );

    setAccountSaving(true);
    popup.showLoading(
      requiresAuthFlow
        ? "Waiting for authorization code. Complete login in the browser..."
        : "Adding backup account...",
    );

    let result = await createBackupAccount({
      remoteName: newRemoteName.trim(),
      provider: newProvider,
      options,
      forceRestart,
    });

    if (
      !result.success &&
      !forceRestart &&
      isAccountAuthConflictError(result.error || "")
    ) {
      const confirmed = await popup.showConfirm(
        "Another account authorization is using the local callback port. Remove the existing authorization and retry?",
      );

      if (confirmed) {
        popup.showLoading("Removing existing authorization and retrying...");
        result = await createBackupAccount({
          remoteName: newRemoteName.trim(),
          provider: newProvider,
          options,
          forceRestart: true,
        });
      }
    }

    setAccountSaving(false);
    if (!result.success) {
      popup.showError(result.error || "Failed to add account");
      return;
    }

    applyDashboardData(result.result);
    if (!remoteName) {
      setRemoteName(newRemoteName.trim());
    }
    setNewRemoteName("");
    setNewOptionsJson("{}");
    popup.showSuccess("Backup account added.");
  };

  const handleDeleteAccount = async (accountName: string) => {
    const confirmed = await popup.showWarning(
      `Delete backup account ${accountName}?`,
    );
    if (!confirmed) {
      return;
    }

    setAccountSaving(true);
    popup.showLoading("Removing backup account...");

    const result = await deleteBackupAccount(accountName);
    setAccountSaving(false);

    if (!result.success) {
      popup.showError(result.error || "Failed to delete account");
      return;
    }

    applyDashboardData(result.result);
    popup.showSuccess("Backup account removed.");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SettingsCard
          title="Backup & Audit"
          description="Loading backup configuration..."
        >
          <div className="px-7 py-8 text-sm text-base-content/50">
            Loading...
          </div>
        </SettingsCard>
      </div>
    );
  }

  const isBackupRunning = lastRunStatus === "RUNNING";
  const canRunNow =
    !!remoteName && !runningBackup && !cancellingBackup && !isBackupRunning;

  return (
    <div className="space-y-6">
      <SettingsCard
        title="Backup Schedule"
        description="Configure automatic backups with rclone remotes. Source is fixed to dev.db."
      >
        <SettingsRow
          label="Enable Automatic Backups"
          description="When enabled, the server runs backups on your selected interval."
        >
          <Toggle checked={enabled} onChange={setEnabled} />
        </SettingsRow>
        <SettingsRow
          label="Backup Interval"
          description="How often to run backups (for example every 5 or 10 minutes)."
        >
          <SelectField
            value={intervalMinutes}
            onChange={setIntervalMinutes}
            options={intervalOptions.map((minutes) => ({
              value: String(minutes),
              label: `Every ${minutes} minute${minutes > 1 ? "s" : ""}`,
            }))}
          />
        </SettingsRow>
        <SettingsRow
          label="First Backup Date & Time"
          description="Optional. If empty, backup starts after one interval."
        >
          <input
            type="datetime-local"
            value={nextRunAt}
            onChange={(e) => setNextRunAt(e.target.value)}
            className="input input-bordered text-sm h-10 min-w-48 bg-base-100 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-lg"
          />
        </SettingsRow>
        <SettingsRow
          label="Destination Account"
          description="Select which configured cloud account receives the backup."
        >
          <SelectField
            value={remoteName}
            onChange={setRemoteName}
            options={[
              {
                value: "",
                label: remotes.length ? "Select account" : "No accounts yet",
              },
              ...remotes.map((remote) => ({
                value: remote.name,
                label: `${remote.name} (${remote.provider})`,
              })),
            ]}
          />
        </SettingsRow>
        <SettingsRow
          label="Destination Folder"
          description="Folder path inside the selected remote destination."
        >
          <InputField
            value={remotePath}
            onChange={setRemotePath}
            placeholder="rtc-backups"
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard
        title="Backup Accounts"
        description="Add cloud destinations like Google Drive using rclone from this UI."
      >
        <div className="px-7 py-5 space-y-4">
          {remotes.length === 0 ? (
            <p className="text-sm text-base-content/40">
              No backup accounts configured yet.
            </p>
          ) : (
            <div className="space-y-2">
              {remotes.map((remote) => (
                <div
                  key={remote.name}
                  className="flex items-center justify-between rounded-xl border border-base-300/60 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-base-content truncate">
                      {remote.name}
                    </p>
                    <p className="text-xs text-base-content/40 uppercase tracking-wide mt-0.5">
                      {remote.provider}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDeleteAccount(remote.name)}
                    disabled={accountSaving}
                    className="btn btn-ghost btn-sm text-error/80 hover:text-error rounded-lg"
                  >
                    <FiTrash2 size={14} /> Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <InputField
              value={newRemoteName}
              onChange={setNewRemoteName}
              placeholder="Account name (example: mygdrive)"
            />
            <SelectField
              value={newProvider}
              onChange={setNewProvider}
              options={providers.map((provider) => ({
                value: provider.value,
                label: provider.label,
              }))}
            />
          </div>

          <div>
            <p className="text-xs text-base-content/35 mb-1.5">
              Provider options JSON (optional). Example for non-interactive
              setup: <span className="font-mono">{'{"scope":"drive"}'}</span>
            </p>
            <textarea
              value={newOptionsJson}
              onChange={(e) => setNewOptionsJson(e.target.value)}
              rows={4}
              className="textarea textarea-bordered w-full text-sm bg-base-100 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-xl"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleCreateAccount()}
              disabled={accountSaving}
              className="btn btn-outline btn-sm gap-2"
            >
              <FiPlus size={15} /> Add Account
            </button>
          </div>

          {accountSetupInProgress && (
            <p className="text-xs text-warning">
              Account authorization is already running. Click Add Account to
              override and cancel the current sign-in flow.
            </p>
          )}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Run Status"
        description="Trigger a manual backup and monitor latest execution details."
      >
        <div className="px-7 py-5 space-y-2 text-sm">
          <p>
            <span className="text-base-content/45">Last run:</span>{" "}
            <span className="font-medium text-base-content">
              {lastRunAt ? new Date(lastRunAt).toLocaleString() : "Never"}
            </span>
          </p>
          <p>
            <span className="text-base-content/45">Status:</span>{" "}
            <span
              className={[
                "font-semibold",
                lastRunStatus === "SUCCESS"
                  ? "text-success"
                  : lastRunStatus === "FAILED"
                    ? "text-error"
                    : lastRunStatus === "CANCELLED"
                      ? "text-warning"
                      : lastRunStatus === "RUNNING"
                        ? "text-warning"
                        : "text-base-content",
              ].join(" ")}
            >
              {lastRunStatus}
            </span>
          </p>
          {lastRunMessage && (
            <p className="text-xs text-base-content/50 leading-relaxed">
              {lastRunMessage}
            </p>
          )}
        </div>
        <div className="px-7 pb-5">
          {isBackupRunning ? (
            <button
              type="button"
              onClick={() => void handleCancelBackup()}
              disabled={cancellingBackup}
              className="btn btn-error btn-sm gap-2.5 text-sm rounded-lg"
            >
              <FiXCircle size={15} /> Cancel Backup
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleRunBackupNow()}
              disabled={!canRunNow}
              className="btn btn-outline btn-sm gap-2.5 text-sm rounded-lg"
            >
              <FiDatabase size={15} /> Backup Now
            </button>
          )}
          {!remoteName && (
            <p className="text-xs text-base-content/35 mt-2">
              Select or create a destination account to enable manual backup.
            </p>
          )}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Backup Console"
        description="Live rclone output and backup activity logs."
      >
        <div className="px-7 py-5">
          <div className="mockup-code w-full max-h-80 overflow-auto">
            {logs.length === 0 ? (
              <pre data-prefix=">">
                <code>No logs yet. Run a backup to see output.</code>
              </pre>
            ) : (
              logs.map((log, index) => (
                <pre
                  key={`${log.at}-${String(index)}`}
                  data-prefix={
                    log.level === "error"
                      ? "!"
                      : log.level === "warn"
                        ? "~"
                        : ">"
                  }
                  className={
                    log.level === "error"
                      ? "text-error"
                      : log.level === "warn"
                        ? "text-warning"
                        : undefined
                  }
                >
                  <code>
                    [{new Date(log.at).toLocaleTimeString()}] {log.message}
                  </code>
                </pre>
              ))
            )}
          </div>
        </div>
      </SettingsCard>

      <div className="flex justify-end">
        <SaveButton
          onClick={
            saving || runningBackup || cancellingBackup ? undefined : handleSave
          }
        />
      </div>
    </div>
  );
};

export default BackupTab;
