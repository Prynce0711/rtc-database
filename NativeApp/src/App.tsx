"use client";

import { CriminalCasePage, Roles } from "@rtc-database/shared";
import { useEffect, useRef, useState } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import criminalCaseAdapter from "./Adapters/CriminalCaseAdapter";
import "./App.css";
import NativeSidebar from "./NativeSidebar";
import SpeederLoader from "./SpeederLoader";

interface BackendInfo {
  url: string;
  ip: string;
  port: number;
  lastSeen: number;
  source?: "udp" | "manual" | "dev" | "saved";
  relayFingerprint256?: string | null;
  relaySubjectName?: string | null;
  relayIssuerName?: string | null;
  pinnedRelayFingerprint256?: string | null;
  usualRelayHostname?: string | null;
  usualRelayProtocol?: "http" | "https" | null;
  usualRelayPort?: number | null;
  usualRelayReachable?: boolean | null;
  relayTrustState?: "trusted" | "new" | "changed" | "unverified";
  relayWarningKind?:
    | "certificate-changed"
    | "different-backend"
    | "unverified"
    | null;
  isPreferred?: boolean;
}

type BackendStatus = "locating" | "located" | "loading";
type AppMode = "connecting" | "local";
type AutoOfflineReason = "disconnected" | "not-found" | null;
type RelayInspectBackendResponse = {
  success: boolean;
  result?: Partial<BackendInfo>;
  error?: string;
};
type RelayTrustUpdateResponse = {
  success: boolean;
  error?: string;
};
type RelayStartupSettingsResponse = {
  success: boolean;
  result?: {
    autoConnectPinnedRelay?: boolean;
    pinnedRelayUrl?: string | null;
  };
  error?: string;
};
type RelayStartupSettingsUpdateResponse = {
  success: boolean;
  result?: {
    autoConnectPinnedRelay?: boolean;
  };
  error?: string;
};
type InspectBackendOptions = {
  requireReachable?: boolean;
  throwOnFailure?: boolean;
};

const HEALTH_PATH = "/api/health";
const HEALTH_TIMEOUT_MS = 5000;
const AUTO_OFFLINE_SECONDS = 10;
const AUTO_OFFLINE_MS = AUTO_OFFLINE_SECONDS * 1000;
const OFFLINE_REASON_QUERY_KEY = "offlineReason";
const RELAY_INSPECT_BACKEND_CHANNEL = "relay:inspect-backend";
const RELAY_TRUST_BACKEND_CHANNEL = "relay:trust-backend";
const RELAY_GET_STARTUP_SETTINGS_CHANNEL = "relay:get-startup-settings";
const RELAY_SET_STARTUP_SETTINGS_CHANNEL = "relay:set-startup-settings";
const DEFAULT_HTTP_PORT = 80;
const DEFAULT_HTTPS_PORT = 443;
// Flip this back to true when we want to restore the offline client flow.
const OFFLINE_MODE_ENABLED = false;

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, "");

const getBackendKey = (backend: BackendInfo): string =>
  normalizeBaseUrl(backend.url);

const buildBackendInfoFromUrl = (url: string): BackendInfo => {
  try {
    const parsedUrl = new URL(url);
    const defaultPort =
      parsedUrl.protocol === "https:" ? DEFAULT_HTTPS_PORT : DEFAULT_HTTP_PORT;

    return {
      url: normalizeBaseUrl(url),
      ip: parsedUrl.hostname,
      port: Number(parsedUrl.port) || defaultPort,
      lastSeen: Date.now(),
    };
  } catch {
    return {
      url: normalizeBaseUrl(url),
      ip: "",
      port: 0,
      lastSeen: Date.now(),
    };
  }
};

const buildManualBackendUrl = (
  protocol: "http" | "https",
  addressInput: string,
  portInput: string,
): string => {
  const trimmedAddress = addressInput.trim();

  if (!trimmedAddress) {
    throw new Error("Enter a server address.");
  }

  const hasProtocolPrefix = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(
    trimmedAddress,
  );
  const parsedUrl = new URL(
    hasProtocolPrefix ? trimmedAddress : `${protocol}://${trimmedAddress}`,
  );
  const normalizedProtocol =
    parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:"
      ? parsedUrl.protocol.slice(0, -1)
      : protocol;
  const fallbackPort =
    normalizedProtocol === "https" ? DEFAULT_HTTPS_PORT : DEFAULT_HTTP_PORT;
  const normalizedPortSource = portInput.trim() || parsedUrl.port;
  const normalizedPort = Number(normalizedPortSource || fallbackPort);

  if (
    !Number.isInteger(normalizedPort) ||
    normalizedPort < 1 ||
    normalizedPort > 65535
  ) {
    throw new Error("Enter a valid port number from 1 to 65535.");
  }

  parsedUrl.protocol = `${normalizedProtocol}:`;
  parsedUrl.port = String(normalizedPort);
  parsedUrl.pathname = "";
  parsedUrl.search = "";
  parsedUrl.hash = "";

  return normalizeBaseUrl(parsedUrl.toString());
};

const sortDiscoveredBackends = (backends: BackendInfo[]): BackendInfo[] =>
  [...backends].sort((left, right) => {
    const preferredDifference =
      Number(Boolean(right.isPreferred)) - Number(Boolean(left.isPreferred));

    if (preferredDifference !== 0) {
      return preferredDifference;
    }

    return right.lastSeen - left.lastSeen;
  });

const upsertDiscoveredBackend = (
  backends: BackendInfo[],
  nextBackend: BackendInfo,
): BackendInfo[] => {
  const backendKey = getBackendKey(nextBackend);
  const existingIndex = backends.findIndex(
    (backend) => getBackendKey(backend) === backendKey,
  );

  if (existingIndex === -1) {
    return sortDiscoveredBackends([...backends, nextBackend]);
  }

  const updatedBackends = [...backends];
  updatedBackends[existingIndex] = {
    ...updatedBackends[existingIndex],
    ...nextBackend,
  };

  return sortDiscoveredBackends(updatedBackends);
};

const formatFingerprint = (value?: string | null): string => {
  if (!value) {
    return "Unavailable";
  }

  return (
    value
      .toUpperCase()
      .match(/.{1,4}/g)
      ?.join(" ") ?? value.toUpperCase()
  );
};

const getFoundBackendLabel = (backend: BackendInfo): string => {
  try {
    return new URL(backend.url).host;
  } catch {
    return backend.url;
  }
};

const getUsualBackendLabel = (backend: BackendInfo): string | null => {
  if (!backend.usualRelayHostname) {
    return null;
  }

  const usualProtocol = backend.usualRelayProtocol ?? "https";
  const defaultPort =
    usualProtocol === "https" ? DEFAULT_HTTPS_PORT : DEFAULT_HTTP_PORT;
  const usualPort = backend.usualRelayPort ?? defaultPort;
  return `${backend.usualRelayHostname}:${String(usualPort)}`;
};

const isUsualRelayUnavailable = (backend: BackendInfo): boolean =>
  backend.relayWarningKind === "different-backend" &&
  backend.usualRelayReachable === false;

const getUnexpectedBackendCopy = (backend: BackendInfo) => {
  const foundBackendLabel = getFoundBackendLabel(backend);
  const usualBackendLabel = getUsualBackendLabel(backend);
  const actionLabel = backend.relayFingerprint256
    ? "Yes, Connect"
    : "Yes, Connect Anyway";

  if (backend.relayWarningKind === "certificate-changed") {
    return {
      title: "This server looks different from the one you usually use",
      description: `We found ${foundBackendLabel}, but its saved security record does not match what this device remembers.`,
      helpText:
        "If your admin told you the server was replaced or updated, choose Yes to connect and save the new security record. If not, choose No and wait for the usual server.",
      actionLabel,
    };
  }

  if (backend.relayWarningKind === "different-backend") {
    if (backend.usualRelayReachable === false) {
      return {
        title: "The usual server can't be reached right now",
        description: usualBackendLabel
          ? `This device usually connects to ${usualBackendLabel}, but we could not reach it right now.`
          : "We could not reach the usual saved server for this device right now.",
        helpText:
          "If your admin gave you a replacement server, choose Yes to connect and save it for next time. Otherwise, choose No and keep waiting.",
        actionLabel,
      };
    }

    return {
      title: "This is not the usual server for this device",
      description: usualBackendLabel
        ? `This device usually connects to ${usualBackendLabel}, but ${foundBackendLabel} answered instead.`
        : `The server that answered was not the usual one for this device.`,
      helpText:
        "If this is the correct replacement server, choose Yes to connect and remember it next time. Otherwise, choose No and keep waiting.",
      actionLabel,
    };
  }

  return {
    title: "We found a server, but we could not confirm it yet",
    description: usualBackendLabel
      ? `This device usually connects to ${usualBackendLabel}, but we could not verify that ${foundBackendLabel} is the same secured server.`
      : `We found ${foundBackendLabel}, but we could not verify its saved secure ID.`,
    helpText:
      "If you expected a server change, choose Yes to continue. If not, choose No and check with your admin first.",
    actionLabel,
  };
};

const parseInitialOfflineReason = (): AutoOfflineReason => {
  if (typeof window === "undefined") {
    return null;
  }

  const reason = new URLSearchParams(window.location.search).get(
    OFFLINE_REASON_QUERY_KEY,
  );

  return reason === "disconnect" ? "disconnected" : null;
};

type LocalModeAppProps = {
  availableBackend: BackendInfo | null;
  onReconnect: () => void;
};

const LocalModeApp = ({ availableBackend, onReconnect }: LocalModeAppProps) => (
  <>
    {availableBackend && (
      <div className="fixed top-4 right-4 z-60 w-[min(92vw,28rem)] alert alert-success shadow-lg items-start">
        <div className="space-y-1">
          <p className="font-semibold">Backend found while offline</p>
          <p className="text-xs opacity-80 break-all">{availableBackend.url}</p>
          <p className="text-xs opacity-70">
            You can reconnect to the online client.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-success btn-sm"
          onClick={onReconnect}
        >
          Reconnect
        </button>
      </div>
    )}

    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/user/dashboard" replace />} />
        <Route
          path="/user/cases/criminal"
          element={
            <NativeSidebar>
              <CriminalCasePage
                role={Roles.USER}
                adapter={criminalCaseAdapter}
              />
            </NativeSidebar>
          }
        />
        <Route
          path="/login"
          element={<Navigate to="/user/dashboard" replace />}
        />
        <Route path="/user/*" element={<NativeSidebar />} />
        <Route path="*" element={<Navigate to="/user/dashboard" replace />} />
      </Routes>
    </HashRouter>
  </>
);

export default function App() {
  const [status, setStatus] = useState<BackendStatus>("locating");
  const [mode, setMode] = useState<AppMode>("connecting");
  const [autoOfflineReason, setAutoOfflineReason] = useState<AutoOfflineReason>(
    () => parseInitialOfflineReason(),
  );
  const [autoOfflineCountdown, setAutoOfflineCountdown] = useState<
    number | null
  >(null);
  const [availableOfflineBackend, setAvailableOfflineBackend] =
    useState<BackendInfo | null>(null);
  const [discoveredBackends, setDiscoveredBackends] = useState<BackendInfo[]>(
    [],
  );
  const [approvingBackendKey, setApprovingBackendKey] = useState<string | null>(
    null,
  );
  const [manualBackendProtocol, setManualBackendProtocol] = useState<
    "http" | "https"
  >("https");
  const [manualBackendAddress, setManualBackendAddress] = useState("");
  const [manualBackendPort, setManualBackendPort] = useState("");
  const [isManualConnectPending, setIsManualConnectPending] = useState(false);
  const [dismissedUnexpectedBackendKeys, setDismissedUnexpectedBackendKeys] =
    useState<string[]>([]);
  const [backendApprovalError, setBackendApprovalError] = useState<
    string | null
  >(null);
  const [manualConnectError, setManualConnectError] = useState<string | null>(
    null,
  );
  const [startupSettingsLoaded, setStartupSettingsLoaded] = useState(false);
  const [autoConnectPinnedRelay, setAutoConnectPinnedRelay] = useState(true);
  const [savedPinnedRelayUrl, setSavedPinnedRelayUrl] = useState<string | null>(
    null,
  );
  const [isSavingStartupPreference, setIsSavingStartupPreference] =
    useState(false);
  const [isTryingSavedRelay, setIsTryingSavedRelay] = useState(false);
  const [startupPreferenceError, setStartupPreferenceError] = useState<
    string | null
  >(null);
  const [isDevMode] = useState(() => import.meta.env.MODE === "development");
  const backendDevUrl = normalizeBaseUrl(
    import.meta.env.VITE_DEV_SERVER_URL || "http://localhost:3000",
  );
  const modeRef = useRef<AppMode>("connecting");
  const redirectTimerRef = useRef<number | null>(null);
  const pendingRedirectUrlRef = useRef<string | null>(null);
  const autoOfflineTimeoutRef = useRef<number | null>(null);
  const autoOfflineIntervalRef = useRef<number | null>(null);
  const backendListenerAttachedRef = useRef(false);
  const attemptedSavedRelayUrlRef = useRef<string | null>(null);

  const clearAutoOfflineTimers = () => {
    if (typeof window === "undefined") {
      return;
    }

    if (autoOfflineTimeoutRef.current !== null) {
      window.clearTimeout(autoOfflineTimeoutRef.current);
      autoOfflineTimeoutRef.current = null;
    }

    if (autoOfflineIntervalRef.current !== null) {
      window.clearInterval(autoOfflineIntervalRef.current);
      autoOfflineIntervalRef.current = null;
    }
  };

  const startAutoOfflineCountdown = (
    reason: Exclude<AutoOfflineReason, null>,
  ) => {
    if (typeof window === "undefined" || modeRef.current !== "connecting") {
      return;
    }

    clearAutoOfflineTimers();
    setAutoOfflineReason(reason);
    setAutoOfflineCountdown(AUTO_OFFLINE_SECONDS);

    autoOfflineIntervalRef.current = window.setInterval(() => {
      setAutoOfflineCountdown((previous) => {
        if (previous === null) {
          return null;
        }

        return previous > 0 ? previous - 1 : 0;
      });
    }, 1000);

    autoOfflineTimeoutRef.current = window.setTimeout(() => {
      if (modeRef.current !== "connecting") {
        return;
      }

      setMode("local");
    }, AUTO_OFFLINE_MS);
  };

  const stopAutoOfflineCountdown = () => {
    clearAutoOfflineTimers();
    setAutoOfflineCountdown(null);
    setAutoOfflineReason(null);
  };

  useEffect(() => {
    if (typeof document === "undefined") return;

    const currentTheme = document.documentElement.getAttribute("data-theme");
    if (currentTheme !== "winter" && currentTheme !== "dim") {
      document.documentElement.setAttribute("data-theme", "winter");
    }
  }, []);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    let isMounted = true;

    if (typeof window === "undefined" || !window.ipcRenderer?.invoke) {
      setStartupSettingsLoaded(true);
      return () => {
        isMounted = false;
      };
    }

    void (async () => {
      try {
        const result = (await window.ipcRenderer.invoke(
          RELAY_GET_STARTUP_SETTINGS_CHANNEL,
        )) as RelayStartupSettingsResponse;

        if (!isMounted) {
          return;
        }

        if (!result.success) {
          throw new Error(
            result.error || "Unable to load startup preferences right now.",
          );
        }

        setAutoConnectPinnedRelay(
          result.result?.autoConnectPinnedRelay ?? true,
        );
        setSavedPinnedRelayUrl(
          result.result?.pinnedRelayUrl
            ? normalizeBaseUrl(result.result.pinnedRelayUrl)
            : null,
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setStartupPreferenceError(
          error instanceof Error
            ? error.message
            : "Unable to load startup preferences right now.",
        );
      } finally {
        if (isMounted) {
          setStartupSettingsLoaded(true);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateAutoConnectPinnedRelayPreference = async (
    enabled: boolean,
  ): Promise<void> => {
    const previousValue = autoConnectPinnedRelay;
    setStartupPreferenceError(null);
    setAutoConnectPinnedRelay(enabled);
    setIsSavingStartupPreference(true);

    try {
      if (typeof window === "undefined" || !window.ipcRenderer?.invoke) {
        return;
      }

      const result = (await window.ipcRenderer.invoke(
        RELAY_SET_STARTUP_SETTINGS_CHANNEL,
        { autoConnectPinnedRelay: enabled },
      )) as RelayStartupSettingsUpdateResponse;

      if (!result.success) {
        throw new Error(
          result.error || "Unable to save startup preference right now.",
        );
      }

      setAutoConnectPinnedRelay(
        result.result?.autoConnectPinnedRelay ?? enabled,
      );
    } catch (error) {
      setAutoConnectPinnedRelay(previousValue);
      setStartupPreferenceError(
        error instanceof Error
          ? error.message
          : "Unable to save startup preference right now.",
      );
    } finally {
      setIsSavingStartupPreference(false);
    }
  };

  const inspectBackendBeforeConnect = async (
    targetUrl: string,
    options: InspectBackendOptions = {},
  ): Promise<BackendInfo> => {
    const baseBackend = buildBackendInfoFromUrl(targetUrl);

    if (typeof window === "undefined" || !window.ipcRenderer?.invoke) {
      return {
        ...baseBackend,
        isPreferred: true,
      };
    }

    try {
      const result = (await window.ipcRenderer.invoke(
        RELAY_INSPECT_BACKEND_CHANNEL,
        {
          url: targetUrl,
          requireReachable: options.requireReachable === true,
        },
      )) as RelayInspectBackendResponse;

      if (!result.success) {
        if (options.throwOnFailure) {
          throw new Error(
            result.error || "Unable to verify that server right now.",
          );
        }

        return {
          ...baseBackend,
          relayTrustState: "unverified",
          relayWarningKind: "unverified",
          isPreferred: false,
        };
      }

      return {
        ...baseBackend,
        ...result.result,
        lastSeen: Date.now(),
      };
    } catch (error) {
      if (options.throwOnFailure) {
        throw error instanceof Error
          ? error
          : new Error("Unable to verify that server right now.");
      }

      return {
        ...baseBackend,
        relayTrustState: "unverified",
        relayWarningKind: "unverified",
        isPreferred: false,
      };
    }
  };

  const redirectToBackend = (targetUrl: string) => {
    if (typeof window === "undefined") {
      return;
    }

    const normalizedTargetUrl = normalizeBaseUrl(targetUrl);

    if (pendingRedirectUrlRef.current === normalizedTargetUrl) {
      return;
    }

    setAvailableOfflineBackend((previousBackend) => {
      if (
        previousBackend &&
        normalizeBaseUrl(previousBackend.url) === normalizedTargetUrl
      ) {
        return previousBackend;
      }

      return {
        url: normalizedTargetUrl,
        ip: previousBackend?.ip ?? "",
        port: previousBackend?.port ?? 0,
        lastSeen: Date.now(),
      };
    });

    try {
      const currentOrigin = normalizeBaseUrl(
        new URL(window.location.href).origin,
      );
      if (currentOrigin === normalizedTargetUrl) {
        return;
      }
    } catch {
      // Ignore URL parsing errors and proceed with redirect attempt.
    }

    if (modeRef.current !== "connecting") {
      return;
    }

    pendingRedirectUrlRef.current = normalizedTargetUrl;
    setBackendApprovalError(null);
    stopAutoOfflineCountdown();
    setStatus("located");

    if (redirectTimerRef.current !== null) {
      window.clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }

    redirectTimerRef.current = window.setTimeout(() => {
      if (modeRef.current !== "connecting") {
        return;
      }

      setStatus("loading");
      window.location.href = normalizedTargetUrl;
    }, 1200);
  };

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !window.ipcRenderer?.onBackend ||
      backendListenerAttachedRef.current
    ) {
      return;
    }

    backendListenerAttachedRef.current = true;

    window.ipcRenderer.onBackend((backend: BackendInfo) => {
      const discoveredBackend: BackendInfo = {
        ...backend,
        source: "udp",
      };

      setAvailableOfflineBackend(discoveredBackend);
      setDiscoveredBackends((previousBackends) =>
        upsertDiscoveredBackend(previousBackends, discoveredBackend),
      );

      if (modeRef.current === "local") {
        console.log(
          `[offline] Backend detected while in local mode: ${discoveredBackend.url}`,
        );
        return;
      }

      if (modeRef.current !== "connecting") {
        return;
      }

      console.log(
        `[startup] Backend discovered via UDP: ${discoveredBackend.url} (${discoveredBackend.relayTrustState ?? "unknown"})`,
      );

      if (discoveredBackend.isPreferred) {
        redirectToBackend(discoveredBackend.url);
      }
    });
  }, []);

  useEffect(() => {
    if (!startupSettingsLoaded) {
      return;
    }

    if (mode !== "connecting") {
      return;
    }

    let isSubscribed = true;

    if (OFFLINE_MODE_ENABLED && autoOfflineReason === "disconnected") {
      console.warn(
        "[startup] Backend disconnected. Waiting for reconnect before switching to offline mode.",
      );
      startAutoOfflineCountdown("disconnected");
    }

    const trySavedPinnedRelay = async (): Promise<boolean> => {
      if (!autoConnectPinnedRelay || !savedPinnedRelayUrl) {
        return false;
      }

      const normalizedSavedRelayUrl = normalizeBaseUrl(savedPinnedRelayUrl);
      if (attemptedSavedRelayUrlRef.current === normalizedSavedRelayUrl) {
        return false;
      }

      attemptedSavedRelayUrlRef.current = normalizedSavedRelayUrl;
      setIsTryingSavedRelay(true);

      console.log(
        `[startup] Trying saved relay first: ${normalizedSavedRelayUrl}`,
      );

      try {
        const inspectedBackend: BackendInfo = {
          ...(await inspectBackendBeforeConnect(normalizedSavedRelayUrl, {
            requireReachable: true,
            throwOnFailure: true,
          })),
          source: "saved",
        };

        if (!isSubscribed || modeRef.current !== "connecting") {
          return false;
        }

        setAvailableOfflineBackend(inspectedBackend);
        setDiscoveredBackends((previousBackends) =>
          upsertDiscoveredBackend(previousBackends, inspectedBackend),
        );

        if (!inspectedBackend.isPreferred) {
          console.warn(
            `[startup] Saved relay responded but is blocked pending approval: ${normalizedSavedRelayUrl} (${inspectedBackend.relayTrustState ?? "unknown"}).`,
          );
          return true;
        }

        console.log(
          `[startup] Saved relay healthy. Redirecting to ${normalizedSavedRelayUrl}.`,
        );
        redirectToBackend(inspectedBackend.url);
        return true;
      } catch (error) {
        console.warn(
          `[startup] Saved relay could not be reached. Falling back to discovery: ${normalizedSavedRelayUrl}.`,
          error,
        );
        return false;
      } finally {
        if (isSubscribed) {
          setIsTryingSavedRelay(false);
        }
      }
    };

    const tryDevelopmentBackend = async (): Promise<boolean> => {
      if (!isDevMode) {
        return false;
      }

      console.log(
        `[startup] Dev mode: checking ${backendDevUrl}${HEALTH_PATH}...`,
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

      try {
        const response = await fetch(`${backendDevUrl}${HEALTH_PATH}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          return false;
        }

        const inspectedBackend: BackendInfo = {
          ...(await inspectBackendBeforeConnect(backendDevUrl)),
          source: "dev",
        };
        setAvailableOfflineBackend(inspectedBackend);
        setDiscoveredBackends((previousBackends) =>
          upsertDiscoveredBackend(previousBackends, inspectedBackend),
        );

        if (!inspectedBackend.isPreferred) {
          console.warn(
            `[startup] Dev backend is healthy but blocked pending approval: ${backendDevUrl} (${inspectedBackend.relayTrustState ?? "unknown"}).`,
          );
          return false;
        }

        console.log(
          `[startup] Dev backend healthy. Redirecting to ${backendDevUrl}.`,
        );
        redirectToBackend(inspectedBackend.url);
        return true;
      } catch (error) {
        clearTimeout(timeoutId);
        console.warn(
          "[startup] Dev backend health check failed. Waiting for UDP discovery response.",
          error,
        );
        return false;
      }
    };

    void (async () => {
      const handledBySavedRelay = await trySavedPinnedRelay();
      const connectedInDev = handledBySavedRelay
        ? false
        : await tryDevelopmentBackend();

      if (!handledBySavedRelay && !connectedInDev && isSubscribed) {
        if (isDevMode) {
          console.log("[startup] Waiting for UDP discovery responses...");
        } else {
          console.log(
            "[startup] Production mode: waiting for UDP discovery responses...",
          );
        }

        if (OFFLINE_MODE_ENABLED && autoOfflineReason !== "disconnected") {
          console.warn(
            "[startup] Backend not found. Waiting before switching to offline mode.",
          );
          startAutoOfflineCountdown("not-found");
        }
      }
    })();

    return () => {
      isSubscribed = false;

      clearAutoOfflineTimers();
      pendingRedirectUrlRef.current = null;

      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [
    autoConnectPinnedRelay,
    autoOfflineReason,
    backendDevUrl,
    isDevMode,
    mode,
    savedPinnedRelayUrl,
    startupSettingsLoaded,
  ]);

  const reconnectToBackend = () => {
    if (!availableOfflineBackend || typeof window === "undefined") {
      return;
    }

    const targetUrl = normalizeBaseUrl(availableOfflineBackend.url);
    console.log(`[offline] Reconnecting to backend ${targetUrl}.`);
    window.location.href = targetUrl;
  };

  const reviewBackends = discoveredBackends.filter((backend) => {
    const needsApproval =
      !backend.isPreferred &&
      (backend.relayTrustState === "changed" ||
        backend.relayTrustState === "unverified");
    const shouldShowRelayUnavailableNoticeOnly =
      backend.source !== "manual" && isUsualRelayUnavailable(backend);

    return (
      !dismissedUnexpectedBackendKeys.includes(getBackendKey(backend)) &&
      needsApproval &&
      !shouldShowRelayUnavailableNoticeOnly
    );
  });

  const relayUnavailableBackend =
    reviewBackends.length === 0
      ? (discoveredBackends.find(
          (backend) =>
            backend.source !== "manual" && isUsualRelayUnavailable(backend),
        ) ?? null)
      : null;
  const relayUnavailableBackendLabel = relayUnavailableBackend
    ? getUsualBackendLabel(relayUnavailableBackend)
    : null;

  const hasDismissedUnexpectedBackend = discoveredBackends.some(
    (backend) =>
      dismissedUnexpectedBackendKeys.includes(getBackendKey(backend)) &&
      !backend.isPreferred &&
      (backend.relayTrustState === "changed" ||
        backend.relayTrustState === "unverified"),
  );

  const declineUnexpectedBackend = (backend: BackendInfo) => {
    const backendKey = getBackendKey(backend);

    setBackendApprovalError(null);
    setDismissedUnexpectedBackendKeys((previousKeys) =>
      previousKeys.includes(backendKey)
        ? previousKeys
        : [...previousKeys, backendKey],
    );
  };

  const approveAndConnectToBackend = async (backend: BackendInfo) => {
    if (typeof window === "undefined") {
      return;
    }

    const backendKey = getBackendKey(backend);
    setBackendApprovalError(null);
    setApprovingBackendKey(backendKey);
    setDismissedUnexpectedBackendKeys((previousKeys) =>
      previousKeys.filter((key) => key !== backendKey),
    );

    try {
      if (backend.relayFingerprint256) {
        const result = (await window.ipcRenderer?.invoke?.(
          RELAY_TRUST_BACKEND_CHANNEL,
          {
            url: backend.url,
            relayFingerprint256: backend.relayFingerprint256,
            relaySubjectName: backend.relaySubjectName,
            relayIssuerName: backend.relayIssuerName,
          },
        )) as RelayTrustUpdateResponse | undefined;

        if (!result?.success) {
          throw new Error(result?.error || "Unable to save this server.");
        }

        setSavedPinnedRelayUrl(normalizeBaseUrl(backend.url));
      }

      redirectToBackend(backend.url);
    } catch (error) {
      setBackendApprovalError(
        error instanceof Error
          ? error.message
          : "Unable to connect to this server right now.",
      );
    } finally {
      setApprovingBackendKey(null);
    }
  };

  const connectToManualBackend = async () => {
    setManualConnectError(null);
    setBackendApprovalError(null);
    setIsManualConnectPending(true);

    try {
      const manualBackendUrl = buildManualBackendUrl(
        manualBackendProtocol,
        manualBackendAddress,
        manualBackendPort,
      );
      const inspectedBackend: BackendInfo = {
        ...(await inspectBackendBeforeConnect(manualBackendUrl, {
          requireReachable: true,
          throwOnFailure: true,
        })),
        source: "manual",
      };

      setAvailableOfflineBackend(inspectedBackend);
      setDiscoveredBackends((previousBackends) =>
        upsertDiscoveredBackend(previousBackends, inspectedBackend),
      );
      setDismissedUnexpectedBackendKeys((previousKeys) =>
        previousKeys.filter((key) => key !== getBackendKey(inspectedBackend)),
      );

      if (!inspectedBackend.isPreferred) {
        return;
      }

      redirectToBackend(inspectedBackend.url);
    } catch (error) {
      setManualConnectError(
        error instanceof Error
          ? error.message
          : "Unable to use that server address right now.",
      );
    } finally {
      setIsManualConnectPending(false);
    }
  };

  if (OFFLINE_MODE_ENABLED && mode === "local") {
    return (
      <LocalModeApp
        availableBackend={availableOfflineBackend}
        onReconnect={reconnectToBackend}
      />
    );
  }

  const connectionHint = !startupSettingsLoaded
    ? "Loading startup preferences..."
    : isTryingSavedRelay
      ? "Trying the usual saved server first."
      : reviewBackends.length > 0
        ? "A different server was found. Please choose Yes or No before this device connects."
        : relayUnavailableBackend
          ? "The usual server can't be reached right now. You can keep waiting or enter another server manually if your admin gave you one."
          : hasDismissedUnexpectedBackend
            ? "You chose not to connect to the different server. Still waiting for the usual server."
            : OFFLINE_MODE_ENABLED
              ? autoOfflineReason === "disconnected"
                ? "Connection to backend was lost. Waiting for it to come back."
                : autoOfflineReason === "not-found"
                  ? "Backend not found yet. Waiting for health check or UDP discovery response."
                  : isDevMode
                    ? "Checking dev backend health, then sending UDP discovery"
                    : "Sending UDP discovery and waiting for gateway response"
              : isDevMode
                ? "Checking dev backend health, then waiting for a backend response"
                : "Sending UDP discovery and waiting for gateway response";

  const shouldHideLoaderForWarning =
    status === "locating" && reviewBackends.length > 0;

  return (
    <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center gap-6 animate-fade-in px-4">
      {!shouldHideLoaderForWarning && <SpeederLoader />}

      <div className="text-center space-y-2 w-full max-w-3xl">
        {status === "locating" && (
          <>
            {reviewBackends.length === 0 && (
              <>
                <p className="text-xl font-semibold">Locating backend...</p>
                <p className="text-sm opacity-70">{connectionHint}</p>
                {OFFLINE_MODE_ENABLED && autoOfflineCountdown !== null && (
                  <p className="text-sm text-warning font-medium">
                    Auto-switching to offline mode in {autoOfflineCountdown}s...
                  </p>
                )}

                {relayUnavailableBackend && (
                  <div className="mx-auto mt-5 w-full max-w-2xl rounded-2xl border border-warning/30 bg-base-100 p-5 text-left shadow-lg space-y-2">
                    <p className="text-base font-semibold text-warning">
                      The usual server can't be reached right now
                    </p>
                    <p className="text-sm opacity-80">
                      {relayUnavailableBackendLabel
                        ? `This device usually connects to ${relayUnavailableBackendLabel}, but we could not reach it right now.`
                        : "We could not reach the usual saved server for this device right now."}
                    </p>
                    <p className="text-xs opacity-70">
                      If your admin gave you a new server address, you can enter
                      it below. Otherwise, keep waiting and try the usual server
                      again.
                    </p>
                  </div>
                )}

                <div className="mx-auto mt-5 w-full max-w-2xl rounded-2xl border border-base-300 bg-base-100 p-5 text-left shadow-sm space-y-4">
                  <div className="space-y-1">
                    <p className="text-base font-semibold">
                      Connect to a server manually
                    </p>
                    <p className="text-sm opacity-70">
                      If automatic discovery is not finding the server, enter
                      the server address and port here.
                    </p>
                  </div>

                  {/* <div className="rounded-xl border border-base-300 bg-base-200/60 px-4 py-3 space-y-2">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        className="toggle toggle-warning toggle-sm mt-0.5"
                        checked={autoConnectPinnedRelay}
                        onChange={(event) =>
                          void updateAutoConnectPinnedRelayPreference(
                            event.target.checked,
                          )
                        }
                        disabled={
                          !startupSettingsLoaded ||
                          isSavingStartupPreference ||
                          isTryingSavedRelay
                        }
                      />
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          Try the usual saved server first
                        </p>
                        <p className="text-xs opacity-70">
                          If this device already remembers a server, try it
                          automatically before waiting for discovery.
                        </p>
                      </div>
                    </label>

                    <p className="text-xs opacity-70 break-all">
                      {savedPinnedRelayUrl
                        ? `Saved server: ${savedPinnedRelayUrl}`
                        : "No saved server has been remembered on this device yet."}
                    </p>

                    {startupPreferenceError && (
                      <p className="text-xs font-medium text-error">
                        {startupPreferenceError}
                      </p>
                    )}
                  </div> */}

                  <div className="grid gap-3 md:grid-cols-[9rem_minmax(0,1fr)_8rem_auto]">
                    <label className="form-control">
                      <span className="label-text text-xs font-medium mb-1">
                        Protocol
                      </span>
                      <select
                        className="select select-bordered"
                        value={manualBackendProtocol}
                        onChange={(event) =>
                          setManualBackendProtocol(
                            event.target.value as "http" | "https",
                          )
                        }
                        disabled={isManualConnectPending || isTryingSavedRelay}
                      >
                        <option value="https">https</option>
                        <option value="http">http</option>
                      </select>
                    </label>

                    <label className="form-control">
                      <span className="label-text text-xs font-medium mb-1">
                        Server address or URL
                      </span>
                      <input
                        type="text"
                        className="input input-bordered w-full"
                        placeholder="192.168.254.72 or https://192.168.254.72"
                        value={manualBackendAddress}
                        onChange={(event) =>
                          setManualBackendAddress(event.target.value)
                        }
                        disabled={isManualConnectPending || isTryingSavedRelay}
                      />
                    </label>

                    <label className="form-control">
                      <span className="label-text text-xs font-medium mb-1">
                        Port
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="input input-bordered w-full"
                        placeholder="3443"
                        value={manualBackendPort}
                        onChange={(event) =>
                          setManualBackendPort(event.target.value)
                        }
                        disabled={isManualConnectPending || isTryingSavedRelay}
                      />
                    </label>

                    <label className="form-control">
                      <span className="label-text text-xs font-medium mb-1 opacity-0">
                        Connect
                      </span>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => void connectToManualBackend()}
                        disabled={isManualConnectPending || isTryingSavedRelay}
                      >
                        {isManualConnectPending ? "Checking..." : "Connect"}
                      </button>
                    </label>
                  </div>

                  {manualConnectError && (
                    <p className="text-sm font-medium text-error">
                      {manualConnectError}
                    </p>
                  )}
                </div>
              </>
            )}

            {reviewBackends.length > 0 && (
              <div className="mx-auto mt-5 w-full max-w-2xl space-y-3 text-left">
                {reviewBackends.map((backend) => {
                  const backendKey = getBackendKey(backend);
                  const noticeCopy = getUnexpectedBackendCopy(backend);
                  const usualBackendLabel = getUsualBackendLabel(backend);
                  const isApproving = approvingBackendKey === backendKey;

                  return (
                    <div
                      key={backendKey}
                      className="rounded-2xl border border-warning/30 bg-base-100 p-5 shadow-lg space-y-3"
                    >
                      <div className="space-y-1">
                        <p className="text-base font-semibold text-warning">
                          {noticeCopy.title}
                        </p>
                        <p className="text-sm opacity-80">
                          {noticeCopy.description}
                        </p>
                      </div>

                      <div className="rounded-xl bg-base-200/80 px-4 py-3 text-xs space-y-2">
                        <p className="font-medium">
                          Server found:
                          <span className="ml-1 break-all font-semibold">
                            {backend.url}
                          </span>
                        </p>

                        {usualBackendLabel && (
                          <p className="font-medium">
                            Usual server on this device:
                            <span className="ml-1 font-semibold">
                              {usualBackendLabel}
                            </span>
                          </p>
                        )}

                        {backend.relayFingerprint256 && (
                          <p className="font-medium">
                            New secure ID:
                            <span className="ml-1 break-all font-mono text-[11px]">
                              {formatFingerprint(backend.relayFingerprint256)}
                            </span>
                          </p>
                        )}

                        {backend.pinnedRelayFingerprint256 && (
                          <p className="font-medium">
                            Saved secure ID:
                            <span className="ml-1 break-all font-mono text-[11px]">
                              {formatFingerprint(
                                backend.pinnedRelayFingerprint256,
                              )}
                            </span>
                          </p>
                        )}
                      </div>

                      <p className="text-xs opacity-70">
                        {noticeCopy.helpText}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-warning btn-sm"
                          onClick={() =>
                            void approveAndConnectToBackend(backend)
                          }
                          disabled={isApproving}
                        >
                          {isApproving ? "Saving..." : noticeCopy.actionLabel}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => declineUnexpectedBackend(backend)}
                          disabled={isApproving}
                        >
                          No, Keep Waiting
                        </button>
                      </div>
                    </div>
                  );
                })}

                {backendApprovalError && (
                  <p className="text-sm font-medium text-error">
                    {backendApprovalError}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {status === "located" && (
          <>
            <p className="text-xl font-semibold text-success">Backend found!</p>
            <p className="text-sm opacity-70">Preparing connection...</p>
          </>
        )}

        {status === "loading" && (
          <>
            <p className="text-xl font-semibold">Connecting to server...</p>
            <p className="text-sm opacity-70">Establishing secure connection</p>
          </>
        )}

        {OFFLINE_MODE_ENABLED && (
          <div className="pt-2">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setMode("local")}
            >
              Switch to offline mode
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
