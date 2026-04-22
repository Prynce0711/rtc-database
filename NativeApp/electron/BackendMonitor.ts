import type { BrowserWindow } from "electron";

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
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    HEALTH_REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}${HEALTH_PATH}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return false;
    }

    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
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
