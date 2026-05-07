import { RELAY_BACKEND_HEALTH_PATH } from "@rtc-database/shared-relay";
import type { BrowserWindow } from "electron";
import { X509Certificate } from "node:crypto";
import type { ClientRequest } from "node:http";
import http from "node:http";
import https from "node:https";
import type { TLSSocket } from "node:tls";
import {
  getPinnedRelayFingerprint,
  isLocalRelayHost,
  normalizeFingerprint,
} from "./relayTrust";

const HEALTH_PATH = "/api/health";
const HEALTH_CHECK_INTERVAL_MS = 5000;
const HEALTH_FAILURE_THRESHOLD = 3;
const HEALTH_REQUEST_TIMEOUT_MS = 5000;
const OFFLINE_REASON_QUERY_KEY = "offlineReason";
const OFFLINE_REASON_DISCONNECT = "disconnect";

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
};

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, "");

const getPeerFingerprint = (socket: ClientRequest["socket"]): string | null => {
  if (
    !socket ||
    typeof (socket as TLSSocket).getPeerCertificate !== "function"
  ) {
    return null;
  }

  const peerCertificate = (socket as TLSSocket).getPeerCertificate(true);

  if (!peerCertificate) {
    return null;
  }

  if (typeof peerCertificate.fingerprint256 === "string") {
    return normalizeFingerprint(peerCertificate.fingerprint256);
  }

  if (
    typeof peerCertificate.raw === "string" ||
    Buffer.isBuffer(peerCertificate.raw)
  ) {
    try {
      return normalizeFingerprint(
        new X509Certificate(peerCertificate.raw).fingerprint256,
      );
    } catch {
      return null;
    }
  }

  return null;
};

const withOfflineReason = (viteLocalUrl: string): string => {
  try {
    const url = new URL(viteLocalUrl);
    url.searchParams.set(OFFLINE_REASON_QUERY_KEY, OFFLINE_REASON_DISCONNECT);
    return url.toString();
  } catch {
    const separator = viteLocalUrl.includes("?") ? "&" : "?";
    return `${viteLocalUrl}${separator}${OFFLINE_REASON_QUERY_KEY}=${OFFLINE_REASON_DISCONNECT}`;
  }
};

const resolveWindowHttpOrigin = (
  browserWindow: BrowserWindow,
): string | null => {
  const currentUrl = browserWindow.webContents.getURL();

  if (!currentUrl) {
    return null;
  }

  try {
    const parsed = new URL(currentUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
};

type HealthCheckResult = "healthy" | "unhealthy" | "missing";

const requestHealthEndpoint = async (
  baseUrl: string,
  healthPath: string,
): Promise<HealthCheckResult> => {
  const target = new URL(baseUrl);

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return "unhealthy";
  }

  return new Promise<HealthCheckResult>((resolve) => {
    const requestImpl =
      target.protocol === "https:" ? https.request : http.request;
    const timeoutId = setTimeout(() => {
      request.destroy(new Error("Health check timed out"));
    }, HEALTH_REQUEST_TIMEOUT_MS);

    const pinnedRelayFingerprint = getPinnedRelayFingerprint();

    const request = requestImpl(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || undefined,
        path: `${target.pathname.replace(/\/+$/, "")}${healthPath}`,
        method: "GET",
        rejectUnauthorized: false,
      },
      (response) => {
        const socket = response.socket as ClientRequest["socket"];

        if (target.protocol === "https:" && isLocalRelayHost(target.hostname)) {
          const fingerprint256 = getPeerFingerprint(socket);

          if (!fingerprint256) {
            response.resume();
            clearTimeout(timeoutId);
            resolve("unhealthy");
            return;
          }

          if (
            pinnedRelayFingerprint &&
            pinnedRelayFingerprint !== fingerprint256
          ) {
            console.error(
              `[health] Relay certificate mismatch for ${target.hostname}: expected ${pinnedRelayFingerprint}, received ${fingerprint256}.`,
            );
            response.resume();
            clearTimeout(timeoutId);
            resolve("unhealthy");
            return;
          }
        }

        response.resume();
        response.once("end", () => {
          clearTimeout(timeoutId);
          resolve(
            response.statusCode !== undefined &&
              response.statusCode >= 200 &&
              response.statusCode < 300
              ? "healthy"
              : response.statusCode === 404
                ? "missing"
                : "unhealthy",
          );
        });
      },
    );

    request.on("error", () => {
      clearTimeout(timeoutId);
      resolve("unhealthy");
    });

    request.end();
  });
};

const isBackendHealthy = async (baseUrl: string): Promise<boolean> => {
  const relayBackendHealth = await requestHealthEndpoint(
    baseUrl,
    RELAY_BACKEND_HEALTH_PATH,
  );

  if (relayBackendHealth !== "missing") {
    return relayBackendHealth === "healthy";
  }

  return (await requestHealthEndpoint(baseUrl, HEALTH_PATH)) === "healthy";
};

export const startBackendDisconnectMonitor = (
  browserWindow: BrowserWindow,
  localAppUrl: string,
): void => {
  let consecutiveFailures = 0;
  let isRedirectingToLocalApp = false;
  const localAppBaseUrl = normalizeBaseUrl(localAppUrl);
  const fallbackUrl = withOfflineReason(localAppUrl);

  const redirectToLocalApp = async (reason: string): Promise<void> => {
    if (browserWindow.isDestroyed() || isRedirectingToLocalApp) {
      return;
    }

    isRedirectingToLocalApp = true;
    console.warn(`[health] ${reason}. Switching back to local app ${fallbackUrl}.`);

    try {
      await browserWindow.loadURL(fallbackUrl);
    } catch (error) {
      console.warn(
        "[health] Failed to switch back to local app URL:",
        formatError(error),
      );
    } finally {
      isRedirectingToLocalApp = false;
    }
  };

  browserWindow.webContents.session.webRequest.onCompleted(
    { urls: ["http://*/*", "https://*/*"] },
    (details) => {
      if (
        browserWindow.isDestroyed() ||
        details.webContentsId !== browserWindow.webContents.id ||
        details.resourceType !== "mainFrame" ||
        details.statusCode < 500
      ) {
        return;
      }

      try {
        const failedUrl = new URL(details.url);
        if (normalizeBaseUrl(failedUrl.origin) === localAppBaseUrl) {
          return;
        }
      } catch {
        return;
      }

      consecutiveFailures = 0;
      void redirectToLocalApp(
        `Main page returned HTTP ${String(details.statusCode)} for ${details.url}`,
      );
    },
  );

  const runHealthCheck = async (): Promise<void> => {
    if (browserWindow.isDestroyed()) {
      return;
    }

    const currentOrigin = resolveWindowHttpOrigin(browserWindow);

    if (
      !currentOrigin ||
      normalizeBaseUrl(currentOrigin) === localAppBaseUrl
    ) {
      consecutiveFailures = 0;
      setTimeout(() => {
        void runHealthCheck();
      }, HEALTH_CHECK_INTERVAL_MS);
      return;
    }

    const healthy = await isBackendHealthy(currentOrigin);

    if (healthy) {
      if (consecutiveFailures > 0) {
        console.log(
          `[health] Backend recovered after ${String(consecutiveFailures)} failed check(s).`,
        );
      }

      consecutiveFailures = 0;
      setTimeout(() => {
        void runHealthCheck();
      }, HEALTH_CHECK_INTERVAL_MS);
      return;
    }

    consecutiveFailures += 1;
    console.warn(
      `[health] Backend check failed (${String(consecutiveFailures)}/${String(HEALTH_FAILURE_THRESHOLD)}) for ${currentOrigin}.`,
    );

    if (consecutiveFailures >= HEALTH_FAILURE_THRESHOLD) {
      consecutiveFailures = 0;
      await redirectToLocalApp("Backend disconnected");
    }

    setTimeout(() => {
      void runHealthCheck();
    }, HEALTH_CHECK_INTERVAL_MS);
  };

  setTimeout(() => {
    void runHealthCheck();
  }, HEALTH_CHECK_INTERVAL_MS);
};

export const startDevDisconnectMonitor = startBackendDisconnectMonitor;
