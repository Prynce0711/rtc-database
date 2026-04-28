import {
  type BackendInfo,
  UDP_DISCOVERY_MULTICAST_GROUP,
  UDP_DISCOVERY_MULTICAST_TTL,
  UDP_DISCOVERY_REQUEST_TYPE,
  UDP_SERVICE_NAME,
  UdpDiscoveryRequest,
  UdpDiscoveryResponse,
} from "@rtc-database/shared/src/UdpData";
import dgram from "dgram";
import { BrowserWindow } from "electron";
import { inspectBackendTrust, probeRelayReachability } from "./relayTrust";

const UDP_PORT = 41234;
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

const resolveAdvertisedHost = (
  candidateHost: string | undefined,
  sourceAddress: string,
): string | null => {
  const trimmedHost = candidateHost?.trim();
  if (!trimmedHost) {
    return sourceAddress.trim() || null;
  }

  if (trimmedHost === "0.0.0.0") {
    return sourceAddress.trim() || null;
  }

  return trimmedHost;
};

const buildBackendInfo = (
  payload: { protocol?: "http" | "https"; host: string; port: number },
  resolvedHost: string,
): BackendInfo => {
  const protocol = payload.protocol ?? "http";

  return {
    url: `${protocol}://${resolvedHost}:${String(payload.port)}`,
    ip: resolvedHost,
    port: payload.port,
    lastSeen: Date.now(),
  };
};

const enrichBackendTrust = async (
  backend: BackendInfo,
): Promise<BackendInfo> => ({
  ...backend,
  ...(await inspectBackendTrust(backend.url)),
});

const getCandidateBackends = (
  payload: {
    protocol?: "http" | "https";
    host: string;
    hosts?: string[];
    port: number;
  },
  sourceAddress: string,
): BackendInfo[] => {
  const candidates: BackendInfo[] = [];
  const seenUrls = new Set<string>();

  const appendCandidate = (candidateHost: string | undefined): void => {
    const resolvedHost = resolveAdvertisedHost(candidateHost, sourceAddress);
    if (!resolvedHost) {
      return;
    }

    const backend = buildBackendInfo(payload, resolvedHost);
    if (seenUrls.has(backend.url)) {
      return;
    }

    seenUrls.add(backend.url);
    candidates.push(backend);
  };

  appendCandidate(sourceAddress);

  for (const advertisedHost of payload.hosts ?? []) {
    appendCandidate(advertisedHost);
  }

  appendCandidate(payload.host);

  return candidates;
};

const resolveReachableBackend = async (
  payload: {
    protocol?: "http" | "https";
    host: string;
    hosts?: string[];
    port: number;
  },
  sourceAddress: string,
): Promise<BackendInfo | null> => {
  const candidateBackends = getCandidateBackends(payload, sourceAddress);
  if (candidateBackends.length === 0) {
    return null;
  }

  const reachabilityResults = await Promise.all(
    candidateBackends.map(async (backend) => ({
      backend,
      reachable: await probeRelayReachability(backend.url),
    })),
  );

  const reachableBackend = reachabilityResults.find(
    (candidate) => candidate.reachable,
  )?.backend;

  if (!reachableBackend) {
    return null;
  }

  return enrichBackendTrust(reachableBackend);
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
    UDP_DISCOVERY_MULTICAST_GROUP,
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
    socket!.setMulticastTTL(UDP_DISCOVERY_MULTICAST_TTL);
    socket!.setMulticastLoopback(true);
    console.log(
      `[udp] Discovery client bound on ${addr.address}:${addr.port} (multicast=${UDP_DISCOVERY_MULTICAST_GROUP}:${UDP_PORT})`,
    );

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

    void (async () => {
      const resolvedBackend = await resolveReachableBackend(
        response.data,
        rinfo.address,
      );
      if (!resolvedBackend) {
        console.warn(
          `[udp] Discovery response from ${rinfo.address}:${rinfo.port} did not produce a reachable relay candidate.`,
        );
        return;
      }

      console.log(
        `[udp] Received discovery response from ${rinfo.address}:${rinfo.port} -> ${resolvedBackend.url} (${resolvedBackend.relayTrustState ?? "unknown"})`,
      );

      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send("udp:backend", resolvedBackend);
      }
    })();
  });

  socket.on("error", (err) => {
    console.error("[udp] Discovery client socket error:", err);
    stopUdpListener();
  });

  // Bind to an ephemeral client port so each app instance can discover independently.
  socket.bind(0, "0.0.0.0");
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
