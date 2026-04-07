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
import ModalBase from "../../Popup/ModalBase";
import { usePopup } from "../../Popup/PopupProvider";
import {
  cancelBackupNowAction,
  clearBackupAccountFiles,
  createBackupAccount,
  deleteBackupAccount,
  getBackupDashboard,
  importBackupFromLocalFileAction,
  importBackupFromRemoteAction,
  listOneDriveDriveOptionsAction,
  runBackupNowAction,
  saveBackupConfiguration,
  updateBackupAccount,
  type BackupDashboardData,
  type BackupOneDriveDriveOption,
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
const ELECTRON_REQUIRED_AUTH_MESSAGE =
  "This provider requires the Electron desktop app for account authorization. Open RTC Native App and try again.";
const ONEDRIVE_CLEAR_DRIVE_ID_SENTINEL = "__RTC_ONEDRIVE_NO_DRIVE_ID__";

const PROVIDER_FIELD_MAP: Record<string, ProviderFieldConfig[]> = {
  onedrive: [],
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

type OneDriveDriveSelectorState = {
  remoteName: string;
  options: BackupOneDriveDriveOption[];
  selectedDriveId: string;
  flow: "create" | "edit";
};

type ElectronAuthorizeProviderResult = {
  success: boolean;
  result?: {
    provider: string;
    options: Record<string, string>;
  };
  error?: string;
};

const pickProviderOptionValues = (
  provider: string,
  options: Record<string, string>,
): Record<string, string> => {
  const values: Record<string, string> = {};

  for (const field of getProviderFields(provider)) {
    const fallbackValue =
      provider === "onedrive" && field.key === "config_driveid"
        ? (options.config_driveid ?? options.drive_id ?? "")
        : "";

    values[field.key] = options[field.key] ?? fallbackValue;
  }

  return values;
};

const BackupTab = () => {
  const popup = usePopup();
  const ipc = typeof window !== "undefined" ? window.ipcRenderer : undefined;
  const isElectron = !!ipc?.invoke;

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
  const [oneDriveDriveSelector, setOneDriveDriveSelector] =
    useState<OneDriveDriveSelectorState | null>(null);
  const [savingOneDriveDriveSelection, setSavingOneDriveDriveSelection] =
    useState(false);
  const localImportInputRef = useRef<HTMLInputElement | null>(null);
  const backupConsoleRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedBackupConsoleScrollRef = useRef(false);

  const isAccountAuthConflictError = (message: string): boolean => {
    const lowered = message.toLowerCase();

    return (
      lowered.includes("account authorization is already") ||
      lowered.includes("local callback port") ||
      lowered.includes("failed to start auth webserver")
    );
  };

  const isOneDriveTokenMissingError = (message: string): boolean => {
    const lowered = message.toLowerCase();

    return (
      lowered.includes("empty token") ||
      lowered.includes("failed to configure onedrive") ||
      lowered.includes("log in and authorize rclone") ||
      lowered.includes("waiting for code") ||
      lowered.includes("redirect url") ||
      lowered.includes("config reconnect") ||
      lowered.includes("reconnect")
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

  useEffect(() => {
    const container = backupConsoleRef.current;
    if (!container) {
      return;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const shouldScrollToBottom =
      !hasInitializedBackupConsoleScrollRef.current || distanceFromBottom <= 48;

    if (shouldScrollToBottom) {
      container.scrollTop = container.scrollHeight;
    }

    hasInitializedBackupConsoleScrollRef.current = true;
  }, [logs]);

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

  const authorizeOAuthProviderWithElectron = async (
    providerValue: string,
  ): Promise<Record<string, string> | null> => {
    const normalizedProvider = providerValue.trim().toLowerCase();

    if (!isElectron || !ipc?.invoke) {
      popup.showError(ELECTRON_REQUIRED_AUTH_MESSAGE);
      return null;
    }

    const response = (await ipc.invoke("rclone:authorize-provider", {
      provider: normalizedProvider,
    })) as ElectronAuthorizeProviderResult;

    if (!response?.success || !response.result?.options) {
      popup.showError(
        response?.error || "Failed to authorize provider via Electron.",
      );
      return null;
    }

    return response.result.options;
  };

  const closeOneDriveDriveSelector = () => {
    setOneDriveDriveSelector(null);
    setSavingOneDriveDriveSelection(false);
  };

  const buildInitialOneDriveDriveSelection = (
    options: BackupOneDriveDriveOption[],
    remoteOptions: Record<string, string>,
  ): string => {
    const configuredDriveId = (
      remoteOptions.drive_id ??
      remoteOptions.config_driveid ??
      ""
    ).trim();

    if (configuredDriveId) {
      return configuredDriveId;
    }

    const configuredOption = options.find((entry) => entry.isConfigured);
    if (configuredOption) {
      return configuredOption.id;
    }

    const personalOption = findOneDrivePersonalDriveOption(options);
    if (personalOption) {
      return personalOption.id;
    }

    const defaultOption = options.find((entry) => entry.isDefault);
    if (defaultOption) {
      return defaultOption.id;
    }

    const firstOption = options[0];
    if (firstOption) {
      return firstOption.id;
    }

    return "";
  };

  const findOneDrivePersonalDriveOption = (
    options: BackupOneDriveDriveOption[],
  ): BackupOneDriveDriveOption | null =>
    options.find((entry) => {
      const normalizedName = entry.name.trim().toLowerCase();
      const normalizedType = entry.driveType.trim().toLowerCase();

      return (
        normalizedName.includes("onedrive (personal)") ||
        normalizedType === "personal" ||
        normalizedName.includes("personal")
      );
    }) ?? null;

  const applyOneDriveDriveSelection = async (
    remoteName: string,
    selectedDriveId: string,
    flow: "create" | "edit",
    mode: "manual" | "auto-personal" = "manual",
  ): Promise<boolean> => {
    const baseUpdateOptions: Record<string, string> = {
      config_driveid: selectedDriveId || ONEDRIVE_CLEAR_DRIVE_ID_SENTINEL,
    };

    if (mode === "auto-personal") {
      baseUpdateOptions.__rtc_onedrive_drive_selection_source = "auto-personal";
    }

    popup.showLoading("Applying selected OneDrive drive...");

    let result = await updateBackupAccount({
      currentRemoteName: remoteName,
      nextRemoteName: remoteName,
      provider: "onedrive",
      options: baseUpdateOptions,
    });

    if (!result.success && isOneDriveTokenMissingError(result.error || "")) {
      if (!isElectron) {
        popup.showError(ELECTRON_REQUIRED_AUTH_MESSAGE);
        return false;
      }

      popup.showLoading(
        "OneDrive token is missing. Re-authorizing in Electron...",
      );

      const electronOptions =
        await authorizeOAuthProviderWithElectron("onedrive");

      if (!electronOptions) {
        return false;
      }

      popup.showLoading("Applying selected OneDrive drive...");

      result = await updateBackupAccount({
        currentRemoteName: remoteName,
        nextRemoteName: remoteName,
        provider: "onedrive",
        options: {
          ...baseUpdateOptions,
          ...electronOptions,
        },
      });
    }

    if (!result.success) {
      popup.showError(
        result.error || "Failed to apply selected OneDrive drive",
      );
      return false;
    }

    applyDashboardData(result.result);
    popup.showSuccess(
      flow === "create"
        ? mode === "auto-personal"
          ? "Backup account added and OneDrive (personal) was selected automatically."
          : "Backup account added and OneDrive drive selected."
        : "OneDrive drive selection updated.",
    );

    return true;
  };

  const openOneDriveDriveSelector = async (
    remoteName: string,
    remoteOptions: Record<string, string>,
    flow: "create" | "edit",
  ): Promise<boolean> => {
    popup.showLoading("Loading OneDrive drives...");

    const driveResult = await listOneDriveDriveOptionsAction({
      remoteName,
    });

    if (!driveResult.success) {
      if (flow === "create") {
        popup.showSuccess(
          `Backup account added. Could not load OneDrive drives now (${driveResult.error || "unknown error"}).`,
        );
      } else {
        popup.showError(
          driveResult.error || "Could not load OneDrive drives right now.",
        );
      }
      return false;
    }

    const driveOptions = driveResult.result.drives;
    if (driveOptions.length === 0) {
      if (flow === "create") {
        popup.showSuccess(
          "Backup account added. No OneDrive drives were found.",
        );
      } else {
        popup.showError("No OneDrive drives were found for this account.");
      }
      return false;
    }

    if (flow === "create") {
      const personalDriveOption = findOneDrivePersonalDriveOption(driveOptions);
      if (personalDriveOption) {
        await applyOneDriveDriveSelection(
          remoteName,
          personalDriveOption.id,
          "create",
          "auto-personal",
        );
        return false;
      }
    }

    popup.hidePopup();
    setOneDriveDriveSelector({
      remoteName,
      options: driveOptions,
      selectedDriveId: buildInitialOneDriveDriveSelection(
        driveOptions,
        remoteOptions,
      ),
      flow,
    });

    return true;
  };

  const openOneDriveDriveSelectorForCreate = async (
    remoteName: string,
    remoteOptions: Record<string, string>,
  ): Promise<boolean> =>
    openOneDriveDriveSelector(remoteName, remoteOptions, "create");

  const openOneDriveDriveSelectorForEdit = async () => {
    if (!editingRemoteName) {
      popup.showError("No backup account selected for editing.");
      return;
    }

    const editingRemote = remotes.find(
      (remote) => remote.name === editingRemoteName,
    );

    if (!editingRemote || editingRemote.provider.toLowerCase() !== "onedrive") {
      popup.showError(
        "Drive selector is only available for OneDrive accounts.",
      );
      return;
    }

    await openOneDriveDriveSelector(
      editingRemote.name,
      editingRemote.options ?? {},
      "edit",
    );
  };

  const handleSkipOneDriveDriveSelection = () => {
    if (savingOneDriveDriveSelection) {
      return;
    }

    const isCreateFlow = oneDriveDriveSelector?.flow === "create";
    closeOneDriveDriveSelector();

    if (isCreateFlow) {
      popup.showSuccess("Backup account added.");
    }
  };

  const handleApplyOneDriveDriveSelection = async () => {
    if (!oneDriveDriveSelector) {
      return;
    }

    const selectorFlow = oneDriveDriveSelector.flow;
    const selectedDriveId = oneDriveDriveSelector.selectedDriveId.trim();

    setSavingOneDriveDriveSelection(true);
    const applied = await applyOneDriveDriveSelection(
      oneDriveDriveSelector.remoteName,
      selectedDriveId,
      selectorFlow,
    );

    setSavingOneDriveDriveSelection(false);

    if (!applied) {
      return;
    }

    closeOneDriveDriveSelector();
  };

  const handleCreateAccount = async () => {
    const requiresAuthFlow = OAUTH_PROVIDERS.has(newProvider.toLowerCase());
    if (requiresAuthFlow && !isElectron) {
      popup.showError(ELECTRON_REQUIRED_AUTH_MESSAGE);
      return;
    }

    let forceRestart = false;

    if (!requiresAuthFlow && accountSetupInProgress) {
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

    let accountOptions = options;

    if (requiresAuthFlow) {
      setAccountSaving(true);
      popup.showLoading(
        "Authorizing account in Electron. Complete login in the desktop app browser...",
      );

      const electronOptions =
        await authorizeOAuthProviderWithElectron(newProvider);

      if (!electronOptions) {
        setAccountSaving(false);
        return;
      }

      accountOptions = {
        ...accountOptions,
        ...electronOptions,
      };
    }

    setAccountSaving(true);
    popup.showLoading(
      requiresAuthFlow
        ? "Adding backup account from Electron authorization..."
        : "Adding backup account...",
    );

    let result = await createBackupAccount({
      remoteName: newRemoteName.trim(),
      provider: newProvider,
      options: accountOptions,
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
          options: accountOptions,
          forceRestart: true,
        });
      }
    }

    setAccountSaving(false);
    if (!result.success) {
      popup.showError(result.error || "Failed to add account");
      return;
    }

    const normalizedNewRemote = newRemoteName.trim();
    const normalizedProvider = newProvider.trim().toLowerCase();
    const createdRemote = result.result.remotes.find(
      (remote) => remote.name === normalizedNewRemote,
    );
    const createdRemoteOptions = createdRemote?.options ?? {};
    const createdConfiguredDriveId = (
      createdRemoteOptions.drive_id ??
      createdRemoteOptions.config_driveid ??
      ""
    ).trim();

    applyDashboardData(result.result);

    if (
      normalizedNewRemote &&
      !selectedRemoteNames.includes(normalizedNewRemote)
    ) {
      setSelectedRemoteNames((previous) => [...previous, normalizedNewRemote]);
    }

    resetAccountForm();

    if (normalizedProvider === "onedrive" && normalizedNewRemote) {
      if (createdConfiguredDriveId) {
        popup.showSuccess("Backup account added.");
        return;
      }

      const openedSelector = await openOneDriveDriveSelectorForCreate(
        normalizedNewRemote,
        createdRemoteOptions,
      );

      if (openedSelector) {
        return;
      }

      return;
    }

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

    if (!isElectron) {
      popup.showError(ELECTRON_REQUIRED_AUTH_MESSAGE);
      return;
    }

    setReloggingRemoteName(remoteName);
    popup.showLoading(
      "Authorizing account in Electron. Complete login in the desktop app browser...",
    );

    const electronOptions = await authorizeOAuthProviderWithElectron(provider);

    if (!electronOptions) {
      setReloggingRemoteName(null);
      return;
    }

    popup.showLoading("Applying account authorization on server...");

    const result = await updateBackupAccount({
      currentRemoteName: remoteName,
      nextRemoteName: remoteName,
      provider,
      options: electronOptions,
    });

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

    let deleteBackupFiles = false;
    const backupFolderPath = remotePath.trim();

    if (backupFolderPath) {
      deleteBackupFiles = await popup.showWarning(
        `Also delete backup files in ${accountName}:${backupFolderPath}? This cannot be undone.`,
      );
    } else {
      const continueWithoutDelete = await popup.showConfirm(
        "Backup folder path is empty, so backup files cannot be auto-deleted safely. Continue removing account only?",
      );

      if (!continueWithoutDelete) {
        return;
      }
    }

    setAccountSaving(true);
    popup.showLoading(
      deleteBackupFiles
        ? "Removing backup account and deleting backup files..."
        : "Removing backup account...",
    );

    const result = await deleteBackupAccount(accountName, deleteBackupFiles);
    setAccountSaving(false);

    if (!result.success) {
      const errorMessage = result.error || "Failed to delete account";

      if (
        deleteBackupFiles &&
        errorMessage.toLowerCase().includes("without deleting backup files")
      ) {
        const continueWithoutDelete = await popup.showConfirm(
          `${errorMessage} Continue removing account without deleting backup files?`,
        );

        if (continueWithoutDelete) {
          setAccountSaving(true);
          popup.showLoading(
            "Removing backup account without deleting files...",
          );

          const removeOnlyResult = await deleteBackupAccount(
            accountName,
            false,
          );
          setAccountSaving(false);

          if (!removeOnlyResult.success) {
            popup.showError(
              removeOnlyResult.error || "Failed to delete account",
            );
            return;
          }

          applyDashboardData(removeOnlyResult.result);

          if (editingRemoteName === accountName) {
            resetAccountForm();
          }

          popup.showSuccess(
            "Backup account removed. Remote backup files were not deleted.",
          );
          return;
        }
      }

      popup.showError(errorMessage);
      return;
    }

    applyDashboardData(result.result);

    if (editingRemoteName === accountName) {
      resetAccountForm();
    }

    popup.showSuccess(
      deleteBackupFiles
        ? "Backup account removed and backup files deleted."
        : "Backup account removed.",
    );
  };

  const handleClearAccountFiles = async (accountName: string) => {
    const backupFolderPath = remotePath.trim();

    if (!backupFolderPath) {
      popup.showError(
        "Destination Folder is empty. Set it first before clearing backup files.",
      );
      return;
    }

    const confirmed = await popup.showConfirm(
      `Clear all backup files in ${accountName}:${backupFolderPath}? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setAccountSaving(true);
    popup.showLoading(
      `Clearing backup files from ${accountName}:${backupFolderPath}...`,
    );

    const result = await clearBackupAccountFiles(accountName);
    setAccountSaving(false);

    if (!result.success) {
      popup.showError(result.error || "Failed to clear backup files");
      return;
    }

    applyDashboardData(result.result);
    popup.showSuccess("Backup files cleared for this account.");
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

  const truncateRemoteDetail = (value: string, maxLength = 22): string => {
    const trimmed = value.trim();
    if (trimmed.length <= maxLength) {
      return trimmed;
    }

    return `${trimmed.slice(0, Math.max(0, maxLength - 3))}...`;
  };

  const getRemoteTechnicalDetail = (
    remote: BackupDashboardData["remotes"][number],
  ): string | null => {
    const providerKey = remote.provider.trim().toLowerCase();
    const options = remote.options ?? {};

    if (providerKey === "ftp" || providerKey === "sftp") {
      const host = (options.host ?? "").trim();
      return host ? `Host: ${truncateRemoteDetail(host)}` : null;
    }

    if (providerKey === "s3") {
      const accessKey = (
        options.access_key_id ??
        options.access_key ??
        ""
      ).trim();
      if (!accessKey) {
        return null;
      }

      const keyLabel = accessKey.toUpperCase().startsWith("AKIA")
        ? "AKIA"
        : "Key";
      return `${keyLabel}: ${truncateRemoteDetail(accessKey)}`;
    }

    if (providerKey === "b2") {
      const accountId = (options.account ?? options.account_id ?? "").trim();
      return accountId
        ? `Account ID: ${truncateRemoteDetail(accountId)}`
        : null;
    }

    return null;
  };

  const getRemoteProviderDetails = (
    remote: BackupDashboardData["remotes"][number],
  ): string => {
    const providerLabel = getProviderLabel(remote.provider);

    if (remote.accountIdentity) {
      return `${providerLabel} - ${remote.accountIdentity}`;
    }

    const technicalDetail = getRemoteTechnicalDetail(remote);
    if (technicalDetail) {
      return `${providerLabel} - ${technicalDetail}`;
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
  const requiresAuthFlowForProvider = OAUTH_PROVIDERS.has(
    newProvider.toLowerCase(),
  );
  const oneDriveDriveSelectOptions = oneDriveDriveSelector
    ? oneDriveDriveSelector.options
    : [];
  const selectedOneDriveDriveOption = oneDriveDriveSelector
    ? (oneDriveDriveSelector.options.find(
        (entry) => entry.id === oneDriveDriveSelector.selectedDriveId,
      ) ?? null)
    : null;
  const oneDriveSelectorIsCreateFlow = oneDriveDriveSelector?.flow === "create";

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
                    <button
                      type="button"
                      onClick={() => void handleClearAccountFiles(remote.name)}
                      disabled={accountActionBusy}
                      className="btn btn-ghost btn-sm text-warning rounded-lg"
                    >
                      <FiDatabase size={14} /> Clear Files
                    </button>
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

          {isEditingAccount && newProvider.toLowerCase() === "onedrive" && (
            <div className="flex items-center justify-between rounded-lg border border-base-300/60 bg-base-200/30 px-3 py-2">
              <p className="text-xs text-base-content/75">
                Update which OneDrive drive this account should use.
              </p>
              <button
                type="button"
                onClick={() => void openOneDriveDriveSelectorForEdit()}
                disabled={accountActionBusy || savingOneDriveDriveSelection}
                className="btn btn-ghost btn-sm"
              >
                Select Drive ID
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
              This provider uses OAuth login and requires the Electron desktop
              app for authorization.
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
          <div
            ref={backupConsoleRef}
            className="mockup-code w-full max-h-80 overflow-auto"
          >
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

      {oneDriveDriveSelector && (
        <ModalBase
          onClose={
            savingOneDriveDriveSelection
              ? undefined
              : handleSkipOneDriveDriveSelection
          }
        >
          <div className="bg-base-100 border border-base-300 shadow-xl rounded-2xl px-6 py-5 max-w-xl w-full text-base-content">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-base-content/70">
                  OneDrive Drive Selector
                </p>
                <h3 className="text-lg font-semibold text-base-content mt-1">
                  Select Drive ID for {oneDriveDriveSelector.remoteName}
                </h3>
                <p className="text-xs text-base-content/60 mt-1">
                  {oneDriveSelectorIsCreateFlow
                    ? "Account was created successfully. Choose which OneDrive drive this account should use."
                    : "Choose which OneDrive drive this account should use."}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-base-content/55 uppercase tracking-wide">
                  Available OneDrive Drives
                </label>
                <select
                  value={oneDriveDriveSelector.selectedDriveId}
                  onChange={(event) =>
                    setOneDriveDriveSelector((previous) =>
                      previous
                        ? {
                            ...previous,
                            selectedDriveId: event.target.value,
                          }
                        : previous,
                    )
                  }
                  disabled={savingOneDriveDriveSelection}
                  className="select select-bordered w-full text-sm"
                >
                  {oneDriveDriveSelectOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} [{option.driveType}]
                      {option.isDefault ? " (default)" : ""}
                      {option.isConfigured ? " (configured)" : ""}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-base-content/50 break-all">
                  Drive ID:{" "}
                  {oneDriveDriveSelector.selectedDriveId || "(not selected)"}
                </p>
                {selectedOneDriveDriveOption?.webUrl && (
                  <p className="text-xs text-base-content/45 break-all">
                    URL: {selectedOneDriveDriveOption.webUrl}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSkipOneDriveDriveSelection}
                  disabled={savingOneDriveDriveSelection}
                  className="btn btn-ghost btn-sm"
                >
                  {oneDriveSelectorIsCreateFlow ? "Skip for now" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleApplyOneDriveDriveSelection()}
                  disabled={savingOneDriveDriveSelection}
                  className="btn btn-primary btn-sm"
                >
                  Use Selected Drive
                </button>
              </div>
            </div>
          </div>
        </ModalBase>
      )}
    </div>
  );
};

export default BackupTab;
