import {
  type BackendInfo,
  UDP_DISCOVERY_REQUEST_TYPE,
  UDP_SERVICE_NAME,
  UdpDiscoveryRequest,
  UdpDiscoveryResponse,
} from "@rtc-database/shared/src/UdpData";
import dgram from "dgram";
import { BrowserWindow } from "electron";

const UDP_PORT = 41234;
const BROADCAST_ADDR = "255.255.255.255";
const DISCOVERY_BURST_COUNT = 3;
const DISCOVERY_BURST_INTERVAL_MS = 200;
const DISCOVERY_RETRY_INTERVAL_MS = 10000;

let socket: dgram.Socket | null = null;
let discoveryInterval: NodeJS.Timeout | null = null;
let discoveryBurstTimers: NodeJS.Timeout[] = [];

const clearDiscoveryBurstTimers = (): void => {
  for (const timer of discoveryBurstTimers) {
    clearTimeout(timer);
  }

  discoveryBurstTimers = [];
};

const buildBackendInfo = (
  payload: { host: string; port: number },
  sourceAddress: string,
): BackendInfo => {
  const resolvedHost =
    payload.host && payload.host !== "0.0.0.0" ? payload.host : sourceAddress;

  return {
    url: `http://${resolvedHost}:${payload.port}`,
    ip: resolvedHost,
    port: payload.port,
    lastSeen: Date.now(),
  };
};

const sendDiscoveryRequest = (): void => {
  if (!socket) {
    return;
  }

  const payload: UdpDiscoveryRequest = {
    type: UDP_DISCOVERY_REQUEST_TYPE,
    service: UDP_SERVICE_NAME,
    timestamp: Date.now(),
  };

  socket.send(
    Buffer.from(JSON.stringify(payload)),
    UDP_PORT,
    BROADCAST_ADDR,
    (error) => {
      if (error) {
        console.error("[udp] Failed to send discovery request:", error);
      }
    },
  );
};

const sendDiscoveryBurst = (): void => {
  clearDiscoveryBurstTimers();

  for (let index = 0; index < DISCOVERY_BURST_COUNT; index += 1) {
    const timer = setTimeout(() => {
      sendDiscoveryRequest();
    }, index * DISCOVERY_BURST_INTERVAL_MS);

    discoveryBurstTimers.push(timer);
  }
};

export function startUdpListener(mainWindow: BrowserWindow) {
  if (socket) {
    return;
  }

  console.log("[udp] Starting discovery client...");

  socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

  socket.on("listening", () => {
    const addr = socket!.address();
    socket!.setBroadcast(true);
    console.log(`[udp] Discovery client bound on ${addr.address}:${addr.port}`);

    sendDiscoveryBurst();

    discoveryInterval = setInterval(() => {
      sendDiscoveryBurst();
    }, DISCOVERY_RETRY_INTERVAL_MS);
  });

  socket.on("message", (msg, rinfo) => {
    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(msg.toString());
    } catch {
      return;
    }

    const response = UdpDiscoveryResponse.safeParse(parsedPayload);
    if (!response.success) {
      return;
    }

    if (mainWindow.isDestroyed()) {
      return;
    }

    const backend = buildBackendInfo(response.data, rinfo.address);

    console.log(
      `[udp] Received discovery response from ${rinfo.address}:${rinfo.port} -> ${backend.url}`,
    );
    mainWindow.webContents.send("udp:backend", backend);
  });

  socket.on("error", (err) => {
    console.error("[udp] Discovery client socket error:", err);
    stopUdpListener();
  });

  // Bind to an ephemeral client port so each app instance can discover independently.
  socket.bind();
}

export function stopUdpListener() {
  clearDiscoveryBurstTimers();

  if (discoveryInterval) {
    clearInterval(discoveryInterval);
    discoveryInterval = null;
  }

  if (socket) {
    socket.close();
    socket = null;
  }
}
