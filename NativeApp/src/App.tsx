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
}

type BackendStatus = "locating" | "located" | "loading";
type AppMode = "connecting" | "local";
type AutoOfflineReason = "disconnected" | "not-found" | null;

const HEALTH_PATH = "/api/health";
const HEALTH_TIMEOUT_MS = 5000;
const AUTO_OFFLINE_SECONDS = 10;
const AUTO_OFFLINE_MS = AUTO_OFFLINE_SECONDS * 1000;
const OFFLINE_REASON_QUERY_KEY = "offlineReason";

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, "");

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
  const [isDevMode] = useState(() => import.meta.env.MODE === "development");
  const backendDevUrl = normalizeBaseUrl(
    import.meta.env.VITE_DEV_SERVER_URL || "http://localhost:3000",
  );
  const modeRef = useRef<AppMode>("connecting");
  const redirectTimerRef = useRef<number | null>(null);
  const autoOfflineTimeoutRef = useRef<number | null>(null);
  const autoOfflineIntervalRef = useRef<number | null>(null);
  const offlineBackendListenerAttachedRef = useRef(false);

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
    if (
      mode !== "local" ||
      typeof window === "undefined" ||
      !window.ipcRenderer?.onBackend ||
      offlineBackendListenerAttachedRef.current
    ) {
      return;
    }

    offlineBackendListenerAttachedRef.current = true;

    window.ipcRenderer.onBackend((backend: BackendInfo) => {
      setAvailableOfflineBackend(backend);

      if (modeRef.current === "local") {
        console.log(
          `[offline] Backend detected while in local mode: ${backend.url}`,
        );
      }
    });
  }, [mode]);

  useEffect(() => {
    if (mode !== "connecting") {
      return;
    }

    let isSubscribed = true;

    if (autoOfflineReason === "disconnected") {
      console.warn(
        "[startup] Backend disconnected. Waiting for reconnect before switching to offline mode.",
      );
      startAutoOfflineCountdown("disconnected");
    }

    const redirectToBackend = (targetUrl: string) => {
      if (typeof window === "undefined") {
        return;
      }

      const normalizedTargetUrl = normalizeBaseUrl(targetUrl);
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

      if (!isSubscribed || modeRef.current !== "connecting") {
        return;
      }

      stopAutoOfflineCountdown();
      setStatus("located");

      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }

      redirectTimerRef.current = window.setTimeout(() => {
        if (!isSubscribed || modeRef.current !== "connecting") {
          return;
        }

        setStatus("loading");
        window.location.href = normalizedTargetUrl;
      }, 1200);
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

        console.log(
          `[startup] Dev backend healthy. Redirecting to ${backendDevUrl}.`,
        );
        redirectToBackend(backendDevUrl);
        return true;
      } catch (error) {
        clearTimeout(timeoutId);
        console.warn(
          "[startup] Dev backend health check failed. Waiting for UDP backend broadcast.",
          error,
        );
        return false;
      }
    };

    if (typeof window !== "undefined" && window.ipcRenderer?.onBackend) {
      window.ipcRenderer.onBackend((backend: BackendInfo) => {
        setAvailableOfflineBackend(backend);

        if (!isSubscribed || modeRef.current !== "connecting") {
          return;
        }

        console.log(`[startup] Backend discovered via UDP: ${backend.url}`);
        redirectToBackend(backend.url);
      });
    }

    void (async () => {
      const connectedInDev = await tryDevelopmentBackend();

      if (!connectedInDev && isSubscribed) {
        if (isDevMode) {
          console.log("[startup] Waiting for UDP backend broadcast...");
        } else {
          console.log(
            "[startup] Production mode: waiting for backend broadcast via UDP...",
          );
        }

        if (autoOfflineReason !== "disconnected") {
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

      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [backendDevUrl, isDevMode, mode]);

  const reconnectToBackend = () => {
    if (!availableOfflineBackend || typeof window === "undefined") {
      return;
    }

    const targetUrl = normalizeBaseUrl(availableOfflineBackend.url);
    console.log(`[offline] Reconnecting to backend ${targetUrl}.`);
    window.location.href = targetUrl;
  };

  if (mode === "local") {
    return (
      <LocalModeApp
        availableBackend={availableOfflineBackend}
        onReconnect={reconnectToBackend}
      />
    );
  }

  const connectionHint =
    autoOfflineReason === "disconnected"
      ? "Connection to backend was lost. Waiting for it to come back."
      : autoOfflineReason === "not-found"
        ? "Backend not found yet. Waiting for health check or UDP broadcast."
        : isDevMode
          ? "Checking dev backend health, then listening for UDP broadcast"
          : "Listening for backend broadcast";

  return (
    <div className="min-h-screen bg-base-200 flex flex-col items-center justify-center gap-6 animate-fade-in px-4">
      <SpeederLoader />

      <div className="text-center space-y-2 max-w-md">
        {status === "locating" && (
          <>
            <p className="text-xl font-semibold">Locating backend...</p>
            <p className="text-sm opacity-70">{connectionHint}</p>
            {autoOfflineCountdown !== null && (
              <p className="text-sm text-warning font-medium">
                Auto-switching to offline mode in {autoOfflineCountdown}s...
              </p>
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

        <div className="pt-2">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setMode("local")}
          >
            Switch to offline mode
          </button>
        </div>
      </div>
    </div>
  );
}
