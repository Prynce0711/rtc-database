import { app, BrowserWindow, session } from "electron";

import { X509Certificate } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDevDisconnectMonitor } from "./BackendMonitor";
import { ensureNativeDatabaseReady } from "./databaseBootstrap";
import "./ipcHandlers";
import { startUdpListener, stopUdpListener } from "./udpListener";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;

type RelayCertificatePin = {
  fingerprint256: string;
  hostname: string;
  port: number;
  establishedAt: string;
  subjectName?: string;
  issuerName?: string;
};

type RelayTrustStore = {
  version: 1;
  relay?: RelayCertificatePin;
};

const RELAY_TRUST_STORE_FILENAME = "relay-trust-store.json";
let relayTrustStoreCache: RelayTrustStore | null = null;

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

const getRelayTrustStorePath = (): string =>
  path.join(app.getPath("userData"), RELAY_TRUST_STORE_FILENAME);

const loadRelayTrustStore = (): RelayTrustStore => {
  if (relayTrustStoreCache) {
    return relayTrustStoreCache;
  }

  const storePath = getRelayTrustStorePath();

  try {
    const rawContent = fs.readFileSync(storePath, "utf8");
    const parsed = JSON.parse(rawContent) as Partial<RelayTrustStore>;

    if (parsed.version === 1) {
      relayTrustStoreCache = {
        version: 1,
        relay: parsed.relay,
      };
      return relayTrustStoreCache;
    }
  } catch {
    // No stored trust pin yet.
  }

  relayTrustStoreCache = { version: 1 };
  return relayTrustStoreCache;
};

const saveRelayTrustStore = (): void => {
  if (!relayTrustStoreCache) {
    return;
  }

  const storePath = getRelayTrustStorePath();
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(relayTrustStoreCache, null, 2));
};

const getCertificateFingerprint256 = (certificate: unknown): string | null => {
  if (!certificate || typeof certificate !== "object") {
    return null;
  }

  const candidate = certificate as {
    data?: unknown;
    fingerprint256?: unknown;
    fingerprint?: unknown;
  };

  if (typeof candidate.data === "string" || Buffer.isBuffer(candidate.data)) {
    try {
      return normalizeFingerprint(
        new X509Certificate(candidate.data).fingerprint256,
      );
    } catch {
      return null;
    }
  }

  if (typeof candidate.fingerprint256 === "string") {
    return normalizeFingerprint(candidate.fingerprint256);
  }

  if (typeof candidate.fingerprint === "string") {
    return normalizeFingerprint(candidate.fingerprint);
  }

  return null;
};

const configureRelayCertificatePinning = (): void => {
  const ses = session.defaultSession;

  ses.setCertificateVerifyProc((request, callback) => {
    const hostname = request.hostname.trim();

    if (!isLocalRelayHost(hostname)) {
      callback(-3);
      return;
    }

    const fingerprint256 = getCertificateFingerprint256(request.certificate);

    if (!fingerprint256) {
      console.error(
        `[relay-pin] Unable to read certificate fingerprint for ${hostname}.`,
      );
      callback(-2);
      return;
    }

    const store = loadRelayTrustStore();
    const pinnedRelay = store.relay;

    if (!pinnedRelay) {
      store.relay = {
        fingerprint256,
        hostname,
        port: Number((request as { port?: number }).port) || 0,
        establishedAt: new Date().toISOString(),
        subjectName:
          typeof request.certificate?.subjectName === "string"
            ? request.certificate.subjectName
            : undefined,
        issuerName:
          typeof request.certificate?.issuerName === "string"
            ? request.certificate.issuerName
            : undefined,
      };

      saveRelayTrustStore();
      console.log(
        `[relay-pin] Trusted relay certificate for ${hostname} on first use.`,
      );
      callback(0);
      return;
    }

    if (pinnedRelay.fingerprint256 === fingerprint256) {
      callback(0);
      return;
    }

    console.error(
      `[relay-pin] Certificate mismatch for ${hostname}: expected ${pinnedRelay.fingerprint256}, received ${fingerprint256}.`,
    );
    callback(-2);
  });
};

async function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      nodeIntegration: false, // ❌ never true
      contextIsolation: true, // ✅ always true
      sandbox: true, // ✅ isolates renderer
    },

    autoHideMenuBar: true,
  });

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    await win.loadURL(VITE_DEV_SERVER_URL);
    startDevDisconnectMonitor(win, VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    await win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }

  startUdpListener(win);
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});

app.on("before-quit", () => {
  stopUdpListener();
});

app.whenReady().then(async () => {
  try {
    await ensureNativeDatabaseReady();
  } catch (error) {
    console.error("[db] Failed to initialize native database:", error);
  }

  configureRelayCertificatePinning();
  void createWindow();
});
