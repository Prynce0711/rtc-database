import {
  UDP_DISCOVERY_PORT,
  UDP_DISCOVERY_RESPONSE_TYPE,
  UDP_SERVICE_NAME,
  type UdpDiscoveryResponse,
} from "@rtc-database/shared-relay";
import dgram from "dgram";
import { networkInterfaces } from "node:os";

const UDP_PORT = Number(process.env.UDP_PORT) || UDP_DISCOVERY_PORT;
const ADVERTISED_PORT =
  Number(process.env.UDP_ADVERTISED_PORT) ||
  Number(process.env.RELAY_PORT) ||
  Number(process.env.BACKEND_PORT) ||
  3000;
const ADVERTISED_PROTOCOL =
  process.env.UDP_ADVERTISED_PROTOCOL?.trim().toLowerCase() === "https" ||
  process.env.RELAY_USE_HTTPS?.trim().toLowerCase() === "true"
    ? "https"
    : "http";
const ANNOUNCEMENT_BURST_COUNT = 3;
const ANNOUNCEMENT_BURST_INTERVAL_MS = 200;
const ANNOUNCEMENT_INTERVAL_MS = 5000;

let socket: dgram.Socket | null = null;
let announcementInterval: NodeJS.Timeout | null = null;
let announcementBurstTimers: NodeJS.Timeout[] = [];

type ActiveIpv4Interface = {
  address: string;
  netmask: string;
};

const clearAnnouncementBurstTimers = (): void => {
  for (const timer of announcementBurstTimers) {
    clearTimeout(timer);
  }

  announcementBurstTimers = [];
};

const normalizeAdvertisedHost = (
  value: string | null | undefined,
): string | null => {
  const normalized = value?.trim();
  if (!normalized || normalized === "0.0.0.0") {
    return null;
  }

  return normalized;
};

const getActiveIpv4Interfaces = (): ActiveIpv4Interface[] => {
  const interfaces = networkInterfaces();
  const results = new Map<string, ActiveIpv4Interface>();

  for (const ifaceList of Object.values(interfaces)) {
    if (!ifaceList) {
      continue;
    }

    for (const iface of ifaceList) {
      if (iface.family === "IPv4" && !iface.internal) {
        results.set(iface.address, {
          address: iface.address,
          netmask: iface.netmask,
        });
      }
    }
  }

  return [...results.values()];
};

const getActiveIpv4Addresses = (): string[] =>
  getActiveIpv4Interfaces().map(({ address }) => address);

const parseIpv4 = (value: string): number | null => {
  const octets = value.split(".");
  if (octets.length !== 4) {
    return null;
  }

  let parsedValue = 0;

  for (const octet of octets) {
    const parsedOctet = Number.parseInt(octet, 10);
    if (
      !Number.isInteger(parsedOctet) ||
      parsedOctet < 0 ||
      parsedOctet > 255
    ) {
      return null;
    }

    parsedValue = ((parsedValue << 8) | parsedOctet) >>> 0;
  }

  return parsedValue;
};

const formatIpv4 = (value: number): string =>
  [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join(".");

const getBroadcastAddress = (
  address: string,
  netmask: string,
): string | null => {
  const parsedAddress = parseIpv4(address);
  const parsedNetmask = parseIpv4(netmask);
  if (parsedAddress === null || parsedNetmask === null) {
    return null;
  }

  return formatIpv4((parsedAddress & parsedNetmask) | (~parsedNetmask >>> 0));
};

const getBroadcastTargets = (): string[] => {
  const targets: string[] = [];
  const seenTargets = new Set<string>();

  const appendTarget = (value: string | null): void => {
    const normalized = value?.trim();
    if (!normalized || seenTargets.has(normalized)) {
      return;
    }

    seenTargets.add(normalized);
    targets.push(normalized);
  };

  for (const iface of getActiveIpv4Interfaces()) {
    appendTarget(getBroadcastAddress(iface.address, iface.netmask));
  }

  if (targets.length === 0) {
    appendTarget("255.255.255.255");
  }

  return targets;
};

const getAdvertisedHosts = (): string[] => {
  const configuredHost = normalizeAdvertisedHost(
    process.env.UDP_ADVERTISED_HOST,
  );
  const activeIpv4Addresses = getActiveIpv4Addresses();
  const advertisedHosts: string[] = [];
  const seenHosts = new Set<string>();

  const appendHost = (value: string | null | undefined): void => {
    const normalized = normalizeAdvertisedHost(value);
    if (!normalized || seenHosts.has(normalized)) {
      return;
    }

    seenHosts.add(normalized);
    advertisedHosts.push(normalized);
  };

  for (const address of activeIpv4Addresses) {
    appendHost(address);
  }

  appendHost(configuredHost);

  if (advertisedHosts.length === 0) {
    appendHost("127.0.0.1");
  }

  return advertisedHosts;
};

const buildAnnouncement = (): UdpDiscoveryResponse => {
  const advertisedHosts = getAdvertisedHosts();

  return {
    type: UDP_DISCOVERY_RESPONSE_TYPE,
    service: UDP_SERVICE_NAME,
    protocol: ADVERTISED_PROTOCOL,
    host: advertisedHosts[0] ?? "127.0.0.1",
    hosts: advertisedHosts,
    port: ADVERTISED_PORT,
    timestamp: Date.now(),
  };
};

const broadcastAnnouncement = (): void => {
  if (!socket) {
    return;
  }

  const payload = Buffer.from(JSON.stringify(buildAnnouncement()));
  for (const target of getBroadcastTargets()) {
    socket.send(payload, UDP_PORT, target, (error) => {
      if (error) {
        console.error(
          `[udp] Failed to broadcast discovery announcement to ${target}:${UDP_PORT}:`,
          error,
        );
      }
    });
  }
};

const broadcastAnnouncementBurst = (): void => {
  clearAnnouncementBurstTimers();

  for (let index = 0; index < ANNOUNCEMENT_BURST_COUNT; index += 1) {
    const timer = setTimeout(() => {
      broadcastAnnouncement();
    }, index * ANNOUNCEMENT_BURST_INTERVAL_MS);

    announcementBurstTimers.push(timer);
  }
};

export function startUdpDiscoveryResponder(): void {
  if (socket) {
    return;
  }

  console.log(
    `[udp] Configured advertised host: ${process.env.UDP_ADVERTISED_HOST?.trim() || "none"}`,
  );
  const initialAdvertisedHosts = getAdvertisedHosts();
  const initialBroadcastTargets = getBroadcastTargets();

  socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

  socket.on("listening", () => {
    socket!.setBroadcast(true);

    const address = socket!.address();
    console.log(
      `[udp] Discovery broadcaster bound on ${address.address}:${address.port} (targets=${initialBroadcastTargets.join(", ")}, backends=${initialAdvertisedHosts.join(", ")}:${ADVERTISED_PORT})`,
    );

    broadcastAnnouncementBurst();
    announcementInterval = setInterval(() => {
      broadcastAnnouncementBurst();
    }, ANNOUNCEMENT_INTERVAL_MS);
  });

  socket.on("error", (error) => {
    console.error("[udp] Discovery broadcaster error:", error);
    stopUdpDiscoveryResponder();
  });

  socket.bind(0, "0.0.0.0");
}

export function stopUdpDiscoveryResponder(): void {
  clearAnnouncementBurstTimers();

  if (announcementInterval) {
    clearInterval(announcementInterval);
    announcementInterval = null;
  }

  if (socket) {
    socket.close();
    socket = null;
  }

  console.log("[udp] Discovery broadcaster stopped");
}
