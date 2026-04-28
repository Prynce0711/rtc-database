import {
  type BackendInfo,
  UDP_DISCOVERY_PORT,
  UdpDiscoveryResponse,
} from "@rtc-database/shared/src/UdpData";
import dgram from "dgram";
import { BrowserWindow } from "electron";
import { inspectBackendTrust, probeRelayReachability } from "./relayTrust";

let socket: dgram.Socket | null = null;

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

export function startUdpListener(mainWindow: BrowserWindow) {
  if (socket) {
    return;
  }

  console.log("[udp] Starting discovery listener...");

  socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

  socket.on("listening", () => {
    const addr = socket!.address();
    console.log(
      `[udp] Discovery listener bound on ${addr.address}:${addr.port} (waiting for relay announcements on UDP ${UDP_DISCOVERY_PORT})`,
    );
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
          `[udp] Relay announcement from ${rinfo.address}:${rinfo.port} did not produce a reachable relay candidate.`,
        );
        return;
      }

      console.log(
        `[udp] Received relay announcement from ${rinfo.address}:${rinfo.port} -> ${resolvedBackend.url} (${resolvedBackend.relayTrustState ?? "unknown"})`,
      );

      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send("udp:backend", resolvedBackend);
      }
    })();
  });

  socket.on("error", (err) => {
    console.error("[udp] Discovery listener socket error:", err);
    stopUdpListener();
  });

  // Bind to the shared discovery port so app instances can receive relay broadcasts.
  socket.bind(UDP_DISCOVERY_PORT, "0.0.0.0");
}

export function stopUdpListener() {
  if (socket) {
    socket.close();
    socket = null;
  }
}
