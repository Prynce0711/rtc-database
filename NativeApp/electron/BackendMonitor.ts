import { app, type BrowserWindow } from "electron";
import { X509Certificate } from "node:crypto";
import fs from "node:fs";
import type { ClientRequest } from "node:http";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import type { TLSSocket } from "node:tls";

const RELAY_TRUST_STORE_FILENAME = "relay-trust-store.json";

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

type RelayCertificatePin = {
  fingerprint256: string;
};

type RelayTrustStore = {
  version: 1;
  relay?: RelayCertificatePin;
};

const normalizeFingerprint = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  const withoutPrefix = trimmed.startsWith("sha256/")
    ? trimmed.slice(7)
    : trimmed;
  const withoutSeparators = withoutPrefix.replace(/:/g, "");

  if (/^[0-9a-f]+$/.test(withoutSeparators)) {
    return withoutSeparators;
  }

  const decoded = Buffer.from(withoutSeparators, "base64");
  if (decoded.length === 32) {
    return decoded.toString("hex");
  }

  return withoutSeparators;
};

const isLocalRelayHost = (hostname: string): boolean => {
  const normalizedHost = hostname.trim().toLowerCase();

  if (
    normalizedHost === "localhost" ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "::1"
  ) {
    return true;
  }

  if (normalizedHost.endsWith(".local") || normalizedHost.endsWith(".lan")) {
    return true;
  }

  if (normalizedHost.includes(":")) {
    return normalizedHost.startsWith("fc") || normalizedHost.startsWith("fd");
  }

  const octets = normalizedHost.split(".").map((value) => Number(value));
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value))) {
    return false;
  }

  const [first, second] = octets;
  if (first === 10) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  if (first === 169 && second === 254) return true;

  return false;
};

const getRelayTrustStorePath = (): string => {
  return path.join(app.getPath("userData"), RELAY_TRUST_STORE_FILENAME);
};

const loadRelayTrustStore = (): RelayTrustStore | null => {
  try {
    const rawContent = fs.readFileSync(getRelayTrustStorePath(), "utf8");
    const parsed = JSON.parse(rawContent) as Partial<RelayTrustStore>;

    if (parsed.version === 1 && parsed.relay?.fingerprint256) {
      return {
        version: 1,
        relay: {
          fingerprint256: normalizeFingerprint(parsed.relay.fingerprint256),
        },
      };
    }
  } catch {
    // No trust store yet.
  }

  return null;
};

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

const isBackendHealthy = async (baseUrl: string): Promise<boolean> => {
  const target = new URL(baseUrl);

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    const requestImpl =
      target.protocol === "https:" ? https.request : http.request;
    const timeoutId = setTimeout(() => {
      request.destroy(new Error("Health check timed out"));
    }, HEALTH_REQUEST_TIMEOUT_MS);

    const trustStore =
      target.protocol === "https:" ? loadRelayTrustStore() : null;

    const request = requestImpl(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || undefined,
        path: `${target.pathname.replace(/\/+$/, "")}${HEALTH_PATH}`,
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
            resolve(false);
            return;
          }

          if (
            trustStore?.relay &&
            trustStore.relay.fingerprint256 !== fingerprint256
          ) {
            console.error(
              `[health] Relay certificate mismatch for ${target.hostname}: expected ${trustStore.relay.fingerprint256}, received ${fingerprint256}.`,
            );
            response.resume();
            clearTimeout(timeoutId);
            resolve(false);
            return;
          }
        }

        response.resume();
        response.once("end", () => {
          clearTimeout(timeoutId);
          resolve(
            response.statusCode !== undefined &&
              response.statusCode >= 200 &&
              response.statusCode < 300,
          );
        });
      },
    );

    request.on("error", () => {
      clearTimeout(timeoutId);
      resolve(false);
    });

    request.on("socket", (socket) => {
      socket.once("secureConnect", () => {
        if (
          target.protocol !== "https:" ||
          !isLocalRelayHost(target.hostname)
        ) {
          return;
        }

        const fingerprint256 = getPeerFingerprint(
          socket as ClientRequest["socket"],
        );
        if (!fingerprint256) {
          return;
        }

        if (!trustStore?.relay) {
          // The main process pins the relay certificate. If the store does not exist yet,
          // we still allow the first health probe to succeed once the BrowserWindow has pinned it.
          return;
        }
      });
    });

    request.end();
  });
};

export const startDevDisconnectMonitor = (
  browserWindow: BrowserWindow,
  viteLocalUrl: string,
): void => {
  let consecutiveFailures = 0;
  const viteBaseUrl = normalizeBaseUrl(viteLocalUrl);

  const runHealthCheck = async (): Promise<void> => {
    if (browserWindow.isDestroyed()) {
      return;
    }

    const currentOrigin = resolveWindowHttpOrigin(browserWindow);

    if (!currentOrigin || normalizeBaseUrl(currentOrigin) === viteBaseUrl) {
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
      const fallbackUrl = withOfflineReason(viteLocalUrl);

      console.warn(
        `[health] Backend disconnected. Switching back to Vite local ${fallbackUrl}.`,
      );
      consecutiveFailures = 0;

      if (!browserWindow.isDestroyed()) {
        try {
          await browserWindow.loadURL(fallbackUrl);
        } catch (error) {
          console.warn(
            "[health] Failed to switch back to Vite local URL:",
            formatError(error),
          );
        }
      }
    }

    setTimeout(() => {
      void runHealthCheck();
    }, HEALTH_CHECK_INTERVAL_MS);
  };

  setTimeout(() => {
    void runHealthCheck();
  }, HEALTH_CHECK_INTERVAL_MS);
};
