"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  FiDatabase,
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
  FiXCircle,
} from "react-icons/fi";
import { usePopup } from "../../Popup/PopupProvider";
import {
  cancelBackupNowAction,
  createBackupAccount,
  deleteBackupAccount,
  getBackupDashboard,
  importBackupFromLocalFileAction,
  importBackupFromRemoteAction,
  reloginBackupAccount,
  runBackupNowAction,
  saveBackupConfiguration,
  updateBackupAccount,
  type BackupDashboardData,
} from "../BackupActions";
import MultiSelectPopoverDropdown from "../MultiSelectPopoverDropdown";
import {
  InputField,
  SaveButton,
  SelectField,
  SettingsCard,
  SettingsRow,
  Toggle,
} from "../SettingsPrimitives";

type ProviderFieldConfig = {
  key: string;
  label: string;
  placeholder: string;
  required?: boolean;
  type?: "text" | "password";
};

const OAUTH_PROVIDERS = new Set(["drive", "onedrive", "dropbox"]);

const PROVIDER_FIELD_MAP: Record<string, ProviderFieldConfig[]> = {
  s3: [
    {
      key: "access_key_id",
      label: "Access Key ID",
      placeholder: "AKIA...",
      required: true,
    },
    {
      key: "secret_access_key",
      label: "Secret Access Key",
      placeholder: "Secret key",
      required: true,
      type: "password",
    },
    {
      key: "region",
      label: "Region",
      placeholder: "ap-southeast-1",
    },
    {
      key: "endpoint",
      label: "Endpoint (optional)",
      placeholder: "https://s3.amazonaws.com",
    },
  ],
  b2: [
    {
      key: "account",
      label: "Account ID",
      placeholder: "Backblaze account ID",
      required: true,
    },
    {
      key: "key",
      label: "Application Key",
      placeholder: "Application key",
      required: true,
      type: "password",
    },
  ],
  ftp: [
    {
      key: "host",
      label: "Host",
      placeholder: "ftp.example.com",
      required: true,
    },
    {
      key: "user",
      label: "Username",
      placeholder: "ftp-user",
    },
    {
      key: "pass",
      label: "Password",
      placeholder: "FTP password",
      type: "password",
    },
    {
      key: "port",
      label: "Port",
      placeholder: "21",
    },
  ],
  sftp: [
    {
      key: "host",
      label: "Host",
      placeholder: "sftp.example.com",
      required: true,
    },
    {
      key: "user",
      label: "Username",
      placeholder: "sftp-user",
      required: true,
    },
    {
      key: "pass",
      label: "Password",
      placeholder: "SFTP password",
      type: "password",
    },
    {
      key: "port",
      label: "Port",
      placeholder: "22",
    },
  ],
  local: [],
};

const getProviderFields = (provider: string): ProviderFieldConfig[] =>
  PROVIDER_FIELD_MAP[provider] ?? [];

const pickProviderOptionValues = (
  provider: string,
  options: Record<string, string>,
): Record<string, string> => {
  const values: Record<string, string> = {};

  for (const field of getProviderFields(provider)) {
    values[field.key] = options[field.key] ?? "";
  }

  return values;
};

const BackupTab = () => {
  const popup = usePopup();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);
  const [cancellingBackup, setCancellingBackup] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [reloggingRemoteName, setReloggingRemoteName] = useState<string | null>(
    null,
  );
  const [accountSetupInProgress, setAccountSetupInProgress] = useState(false);
  const [importingRemote, setImportingRemote] = useState(false);
  const [importingLocal, setImportingLocal] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [selectedIntervals, setSelectedIntervals] = useState<string[]>([]);
  const [selectedRemoteNames, setSelectedRemoteNames] = useState<string[]>([]);
  const [remotePath, setRemotePath] = useState("rtc-backups");
  const [importRemoteName, setImportRemoteName] = useState("");
  const [importSource, setImportSource] = useState("manual");
  const [localImportFile, setLocalImportFile] = useState<File | null>(null);

  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [lastRunStatus, setLastRunStatus] = useState("IDLE");
  const [lastRunMessage, setLastRunMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<BackupDashboardData["logs"]>([]);

  const [intervalOptions, setIntervalOptions] = useState<
    BackupDashboardData["intervalOptions"]
  >([]);
  const [importSourceOptions, setImportSourceOptions] = useState<
    BackupDashboardData["importSourceOptions"]
  >([]);
  const [remotes, setRemotes] = useState<BackupDashboardData["remotes"]>([]);
  const [providers, setProviders] = useState<
    Array<{ value: string; label: string; description: string }>
  >([]);

  const [newRemoteName, setNewRemoteName] = useState("");
  const [newProvider, setNewProvider] = useState("drive");
  const [editingRemoteName, setEditingRemoteName] = useState<string | null>(
    null,
  );
  const [providerOptionValues, setProviderOptionValues] = useState<
    Record<string, string>
  >({});
  const localImportInputRef = useRef<HTMLInputElement | null>(null);

  const isAccountAuthConflictError = (message: string): boolean => {
    const lowered = message.toLowerCase();

    return (
      lowered.includes("account authorization is already") ||
      lowered.includes("local callback port") ||
      lowered.includes("failed to start auth webserver")
    );
  };

  const applyDashboardData = useCallback(
    (data: BackupDashboardData) => {
      setEnabled(data.config.enabled);
      setSelectedIntervals(data.config.selectedIntervals);
      setSelectedRemoteNames(data.config.selectedRemoteNames);
      setRemotePath(data.config.remotePath);
      setLastRunAt(data.config.lastRunAt);
      setLastRunStatus(data.config.lastRunStatus);
      setLastRunMessage(data.config.lastRunMessage);
      setLogs(data.logs);
      setRemotes(data.remotes);
      setProviders(data.providers);
      setIntervalOptions(data.intervalOptions);
      setImportSourceOptions(data.importSourceOptions);
      setAccountSetupInProgress(data.accountSetupInProgress);

      if (
        editingRemoteName &&
        !data.remotes.some((remote) => remote.name === editingRemoteName)
      ) {
        setEditingRemoteName(null);
        setProviderOptionValues({});
        setNewRemoteName("");
      }

      setNewProvider((previous) => {
        if (
          previous &&
          data.providers.some((entry) => entry.value === previous)
        ) {
          return previous;
        }

        return data.providers[0]?.value ?? "drive";
      });

      const availableRemoteNames = data.remotes.map((remote) => remote.name);
      setImportRemoteName((previous) => {
        if (previous && availableRemoteNames.includes(previous)) {
          return previous;
        }

        const preferred = data.config.selectedRemoteNames.find((remoteName) =>
          availableRemoteNames.includes(remoteName),
        );

        return preferred ?? availableRemoteNames[0] ?? "";
      });

      const sourceValues = data.importSourceOptions.map((option) =>
        String(option.value),
      );
      setImportSource((previous) => {
        if (previous && sourceValues.includes(previous)) {
          return previous;
        }

        return sourceValues[0] ?? "manual";
      });
    },
    [editingRemoteName],
  );

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
  }, [popup, applyDashboardData]);

  const handleSave = async () => {
    if (enabled && selectedRemoteNames.length === 0) {
      popup.showError(
        "Select at least one destination account before enabling auto backup.",
      );
      return;
    }

    if (enabled && selectedIntervals.length === 0) {
      popup.showError(
        "Select at least one backup interval before enabling automatic backups.",
      );
      return;
    }

    setSaving(true);
    popup.showLoading("Saving backup settings...");

    const result = await saveBackupConfiguration({
      enabled,
      selectedIntervals,
      selectedRemoteNames,
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

  const resetAccountForm = () => {
    setEditingRemoteName(null);
    setNewRemoteName("");
    setProviderOptionValues({});
    setNewProvider(providers[0]?.value ?? "drive");
  };

  const handleProviderChange = (providerValue: string) => {
    setNewProvider(providerValue);
    setProviderOptionValues({});
  };

  const setProviderOptionValue = (key: string, value: string) => {
    setProviderOptionValues((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const buildAccountOptions = (providerValue: string) => {
    const fields = getProviderFields(providerValue);
    const options: Record<string, string> = {};

    for (const field of fields) {
      const rawValue = providerOptionValues[field.key] ?? "";
      const trimmedValue = rawValue.trim();

      if (field.required && !trimmedValue) {
        popup.showError(`${field.label} is required.`);
        return null;
      }

      if (trimmedValue) {
        options[field.key] = trimmedValue;
      }
    }

    return options;
  };

  const handleStartEditAccount = (accountName: string) => {
    const remote = remotes.find((entry) => entry.name === accountName);
    if (!remote) {
      popup.showError("Selected backup account could not be found.");
      return;
    }

    setEditingRemoteName(remote.name);
    setNewRemoteName(remote.name);
    setNewProvider(remote.provider);
    setProviderOptionValues(
      pickProviderOptionValues(remote.provider, remote.options ?? {}),
    );
  };

  const handleCancelEditAccount = () => {
    resetAccountForm();
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

    if (!newRemoteName.trim()) {
      popup.showError("Account name is required.");
      return;
    }

    const options = buildAccountOptions(newProvider);
    if (!options) {
      return;
    }

    const requiresAuthFlow = OAUTH_PROVIDERS.has(newProvider);

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

    const normalizedNewRemote = newRemoteName.trim();
    if (
      normalizedNewRemote &&
      !selectedRemoteNames.includes(normalizedNewRemote)
    ) {
      setSelectedRemoteNames((previous) => [...previous, normalizedNewRemote]);
    }

    resetAccountForm();
    popup.showSuccess("Backup account added.");
  };

  const handleUpdateAccount = async () => {
    if (!editingRemoteName) {
      popup.showError("No backup account selected for editing.");
      return;
    }

    if (!newRemoteName.trim()) {
      popup.showError("Account name is required.");
      return;
    }

    const currentRemote = remotes.find(
      (remote) => remote.name === editingRemoteName,
    );

    if (!currentRemote) {
      popup.showError("Selected backup account no longer exists.");
      return;
    }

    if (currentRemote.provider !== newProvider) {
      popup.showError(
        "Changing provider type is not supported. Create a new account instead.",
      );
      return;
    }

    const options = buildAccountOptions(newProvider);
    if (!options) {
      return;
    }

    setAccountSaving(true);
    popup.showLoading("Updating backup account...");

    const result = await updateBackupAccount({
      currentRemoteName: editingRemoteName,
      nextRemoteName: newRemoteName.trim(),
      provider: newProvider,
      options,
    });

    setAccountSaving(false);
    if (!result.success) {
      popup.showError(result.error || "Failed to update account");
      return;
    }

    applyDashboardData(result.result);
    resetAccountForm();
    popup.showSuccess("Backup account updated.");
  };

  const handleReloginAccount = async (remoteName: string, provider: string) => {
    if (!OAUTH_PROVIDERS.has(provider.toLowerCase())) {
      popup.showError(
        "Re-login is only available for Google Drive, OneDrive, and Dropbox.",
      );
      return;
    }

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

    setReloggingRemoteName(remoteName);
    popup.showLoading(
      "Waiting for authorization code. Complete re-login in the browser...",
    );

    let result = await reloginBackupAccount({
      remoteName,
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
        result = await reloginBackupAccount({
          remoteName,
          forceRestart: true,
        });
      }
    }

    setReloggingRemoteName(null);

    if (!result.success) {
      popup.showError(result.error || "Failed to re-login backup account");
      return;
    }

    applyDashboardData(result.result);

    if (editingRemoteName === remoteName) {
      const refreshedRemote = result.result.remotes.find(
        (remote) => remote.name === remoteName,
      );

      if (refreshedRemote) {
        setProviderOptionValues(
          pickProviderOptionValues(
            refreshedRemote.provider,
            refreshedRemote.options ?? {},
          ),
        );
      }
    }

    popup.showSuccess(`Backup account ${remoteName} re-logged successfully.`);
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

    if (editingRemoteName === accountName) {
      resetAccountForm();
    }

    popup.showSuccess("Backup account removed.");
  };

  const handleImportFromRemote = async () => {
    if (!importRemoteName.trim()) {
      popup.showError("Select a remote account to import from.");
      return;
    }

    const confirmed = await popup.showWarning(
      "This will update database (dev.db) from the selected remote backup. This might log out the current user. Continue?",
    );
    if (!confirmed) {
      return;
    }

    setImportingRemote(true);
    popup.showLoading("Updating database from remote backup...");

    const result = await importBackupFromRemoteAction({
      remoteName: importRemoteName.trim(),
      source: importSource,
    });

    setImportingRemote(false);
    if (!result.success) {
      popup.showError(result.error || "Failed to import backup from remote");
      return;
    }

    applyDashboardData(result.result);
    popup.showSuccess("Database updated from remote backup.");
  };

  const handleOpenLocalFilePicker = () => {
    localImportInputRef.current?.click();
  };

  const handleLocalImportFileSelected = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0] ?? null;
    setLocalImportFile(selectedFile);
  };

  const handleImportFromLocalFile = async () => {
    if (!localImportFile) {
      popup.showError("Choose a local backup file to import.");
      return;
    }

    const confirmed = await popup.showWarning(
      `This will update database (dev.db) from \"${localImportFile.name}\". This might log out the current user. Continue?`,
    );
    if (!confirmed) {
      return;
    }

    setImportingLocal(true);
    popup.showLoading("Updating database from local backup file...");

    const formData = new FormData();
    formData.set("file", localImportFile);

    const result = await importBackupFromLocalFileAction(formData);

    setImportingLocal(false);
    if (!result.success) {
      popup.showError(
        result.error || "Failed to import backup from local file",
      );
      return;
    }

    applyDashboardData(result.result);
    setLocalImportFile(null);
    if (localImportInputRef.current) {
      localImportInputRef.current.value = "";
    }
    popup.showSuccess("Database updated from local backup file.");
  };

  const toggleIntervalSelection = (intervalValue: string) => {
    setSelectedIntervals((previous) => {
      if (previous.includes(intervalValue)) {
        return previous.filter((value) => value !== intervalValue);
      }

      return [...previous, intervalValue];
    });
  };

  const toggleRemoteSelection = (remoteValue: string) => {
    setSelectedRemoteNames((previous) => {
      if (previous.includes(remoteValue)) {
        return previous.filter((value) => value !== remoteValue);
      }

      return [...previous, remoteValue];
    });
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
    selectedRemoteNames.length > 0 &&
    !runningBackup &&
    !cancellingBackup &&
    !importingRemote &&
    !importingLocal &&
    !isBackupRunning;

  const selectedIntervalLabels = intervalOptions
    .filter((interval) => selectedIntervals.includes(interval.value))
    .map((interval) => interval.label);

  const providerLabelLookup = new Map(
    providers.map((provider) => [provider.value.toLowerCase(), provider.label]),
  );

  const getProviderLabel = (providerValue: string): string =>
    providerLabelLookup.get(providerValue.toLowerCase()) || providerValue;

  const getRemoteProviderDetails = (
    remote: BackupDashboardData["remotes"][number],
  ): string => {
    const providerLabel = getProviderLabel(remote.provider);

    if (remote.accountIdentity) {
      return `${providerLabel} - ${remote.accountIdentity}`;
    }

    return providerLabel;
  };

  const selectedRemoteLabels = remotes
    .filter((remote) => selectedRemoteNames.includes(remote.name))
    .map((remote) => `${remote.name} (${getRemoteProviderDetails(remote)})`);

  const intervalSummary =
    selectedIntervalLabels.length === 0
      ? "Choose intervals to activate"
      : `${selectedIntervalLabels.length} interval${selectedIntervalLabels.length > 1 ? "s" : ""} selected`;

  const remoteSummary =
    selectedRemoteLabels.length === 0
      ? remotes.length === 0
        ? "No accounts available"
        : "Choose destination accounts"
      : `${selectedRemoteLabels.length} account${selectedRemoteLabels.length > 1 ? "s" : ""} selected`;

  const intervalDropdownOptions = intervalOptions.map((interval) => ({
    value: interval.value,
    label: interval.label,
    description: `Folder: ${interval.folderName}`,
  }));

  const remoteDropdownOptions = remotes.map((remote) => ({
    value: remote.name,
    label: remote.name,
    description: getRemoteProviderDetails(remote),
  }));

  const isEditingAccount = editingRemoteName !== null;
  const accountActionBusy = accountSaving || reloggingRemoteName !== null;
  const accountProviderFields = getProviderFields(newProvider);
  const requiresAuthFlowForProvider = OAUTH_PROVIDERS.has(newProvider);

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
          label="Backup Intervals"
          description="Select one or more schedules. Each interval writes to its own folder and replaces the previous backup in that folder."
        >
          <div className="w-full">
            <MultiSelectPopoverDropdown
              popoverId="backup-intervals-popover"
              anchorName="--backup-intervals-anchor"
              summary={intervalSummary}
              options={intervalDropdownOptions}
              selectedValues={selectedIntervals}
              onToggle={toggleIntervalSelection}
              emptyLabel="No intervals available."
            />
          </div>
        </SettingsRow>
        <SettingsRow
          label="Destination Accounts"
          description="Select one or more configured cloud accounts to receive each backup run."
        >
          {remotes.length === 0 ? (
            <p className="text-sm text-base-content/45">No accounts yet.</p>
          ) : (
            <div className="w-full">
              <MultiSelectPopoverDropdown
                popoverId="backup-remotes-popover"
                anchorName="--backup-remotes-anchor"
                summary={remoteSummary}
                options={remoteDropdownOptions}
                selectedValues={selectedRemoteNames}
                onToggle={toggleRemoteSelection}
                emptyLabel="No accounts yet."
              />
            </div>
          )}
        </SettingsRow>
        <SettingsRow
          label="Destination Folder"
          description="Base folder path inside the selected remote. Automatic backups create one subfolder per interval; manual backups use a manual folder."
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
        description="Create and edit backup destinations. OAuth providers use browser login, while non-OAuth providers use direct connection fields."
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
                    <p className="text-xs text-base-content/40 tracking-wide mt-0.5 break-all">
                      {getRemoteProviderDetails(remote)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {OAUTH_PROVIDERS.has(remote.provider.toLowerCase()) && (
                      <button
                        type="button"
                        onClick={() =>
                          void handleReloginAccount(
                            remote.name,
                            remote.provider,
                          )
                        }
                        disabled={accountActionBusy}
                        className="btn btn-ghost btn-sm text-info rounded-lg"
                      >
                        <FiRefreshCw size={14} /> Re-login
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleStartEditAccount(remote.name)}
                      disabled={accountActionBusy}
                      className="btn btn-ghost btn-sm rounded-lg"
                    >
                      <FiEdit2 size={14} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteAccount(remote.name)}
                      disabled={accountActionBusy}
                      className="btn btn-ghost btn-sm text-error/80 hover:text-error rounded-lg"
                    >
                      <FiTrash2 size={14} /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isEditingAccount && (
            <p className="text-xs text-info">
              Editing <span className="font-semibold">{editingRemoteName}</span>
              . Provider type cannot be changed for existing accounts.
            </p>
          )}

          {isEditingAccount && requiresAuthFlowForProvider && (
            <div className="flex items-center justify-between rounded-lg border border-info/25 bg-info/5 px-3 py-2">
              <p className="text-xs text-info/90">
                To switch the connected cloud account, use re-login.
              </p>
              <button
                type="button"
                onClick={() =>
                  editingRemoteName
                    ? void handleReloginAccount(editingRemoteName, newProvider)
                    : undefined
                }
                disabled={accountActionBusy || !editingRemoteName}
                className="btn btn-ghost btn-sm text-info"
              >
                <FiRefreshCw size={14} /> Re-login
              </button>
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
              onChange={handleProviderChange}
              disabled={isEditingAccount}
              options={providers.map((provider) => ({
                value: provider.value,
                label: provider.label,
              }))}
            />
          </div>

          {accountProviderFields.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {accountProviderFields.map((field) => (
                <div key={field.key}>
                  <p className="text-xs text-base-content/35 mb-1.5">
                    {field.label}
                    {field.required ? " *" : ""}
                  </p>
                  <input
                    type={field.type ?? "text"}
                    value={providerOptionValues[field.key] ?? ""}
                    onChange={(event) =>
                      setProviderOptionValue(field.key, event.target.value)
                    }
                    placeholder={field.placeholder}
                    disabled={accountActionBusy}
                    className="input input-bordered h-10 w-full text-sm bg-base-100 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 disabled:opacity-40 rounded-lg placeholder:text-base-content/25"
                  />
                </div>
              ))}
            </div>
          ) : requiresAuthFlowForProvider ? (
            <p className="text-xs text-base-content/45">
              This provider uses browser login and does not require manual
              connection fields.
            </p>
          ) : newProvider === "local" ? (
            <p className="text-xs text-base-content/45">
              Local Folder does not require credentials. Set the target path in
              <span className="font-semibold"> Destination Folder</span> under
              Backup Schedule.
            </p>
          ) : (
            <p className="text-xs text-base-content/45">
              No extra fields are required for this provider.
            </p>
          )}

          <div className="flex justify-end gap-2">
            {isEditingAccount && (
              <button
                type="button"
                onClick={handleCancelEditAccount}
                disabled={accountActionBusy}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                void (isEditingAccount
                  ? handleUpdateAccount()
                  : handleCreateAccount())
              }
              disabled={accountActionBusy}
              className="btn btn-outline btn-sm gap-2"
            >
              <FiPlus size={15} />
              {isEditingAccount ? "Save Account" : "Add Account"}
            </button>
          </div>

          {!isEditingAccount && accountSetupInProgress && (
            <p className="text-xs text-warning">
              Account authorization is already running. Click Add Account to
              override and cancel the current sign-in flow.
            </p>
          )}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Import Backup"
        description="Restore from a remote backup folder or a local backup file from this PC. This updates the database file (dev.db)."
      >
        <SettingsRow
          label="Import from Remote"
          description="Choose an account and backup source folder, then update database."
        >
          <div className="w-full space-y-2">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              <SelectField
                value={importRemoteName}
                onChange={setImportRemoteName}
                options={[
                  {
                    value: "",
                    label: remotes.length
                      ? "Select remote account"
                      : "No accounts available",
                  },
                  ...remotes.map((remote) => ({
                    value: remote.name,
                    label: `${remote.name} (${getRemoteProviderDetails(remote)})`,
                  })),
                ]}
              />
              <SelectField
                value={importSource}
                onChange={setImportSource}
                options={importSourceOptions.map((option) => ({
                  value: option.value,
                  label: `${option.label} (${option.folderName})`,
                }))}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleImportFromRemote()}
                disabled={
                  importingRemote || importingLocal || !importRemoteName
                }
                className="btn btn-warning btn-sm"
              >
                Import from Remote
              </button>
            </div>
          </div>
        </SettingsRow>
        <SettingsRow
          label="Import from Local File"
          description="Choose a backup file from this PC, then update database."
        >
          <div className="w-full space-y-2">
            <input
              ref={localImportInputRef}
              type="file"
              onChange={handleLocalImportFileSelected}
              className="hidden"
              accept=".db,.sqlite,.sqlite3,.bak,.backup"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleOpenLocalFilePicker}
                disabled={importingLocal || importingRemote}
                className="btn btn-outline btn-sm"
              >
                Choose Local Backup File
              </button>
              <p className="text-xs text-base-content/55 break-all">
                {localImportFile
                  ? `Selected: ${localImportFile.name}`
                  : "No file selected."}
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleImportFromLocalFile()}
                disabled={importingLocal || importingRemote || !localImportFile}
                className="btn btn-warning btn-sm"
              >
                Import Selected File
              </button>
            </div>
          </div>
        </SettingsRow>
        <div className="px-7 pb-5">
          <p className="text-xs text-warning">
            Importing backup means updating database (dev.db) and might log out
            the current user. Make sure the selected backup file is correct.
          </p>
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
          {selectedRemoteNames.length === 0 && (
            <p className="text-xs text-base-content/35 mt-2">
              Select or create at least one destination account to enable manual
              backup.
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
            saving ||
            runningBackup ||
            cancellingBackup ||
            importingRemote ||
            importingLocal
              ? undefined
              : handleSave
          }
        />
      </div>
    </div>
  );
};

export default BackupTab;
