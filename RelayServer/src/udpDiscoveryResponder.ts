import {
  UDP_DISCOVERY_MULTICAST_GROUP,
  UDP_DISCOVERY_MULTICAST_TTL,
  UDP_DISCOVERY_REQUEST_TYPE,
  UDP_DISCOVERY_RESPONSE_TYPE,
  UDP_SERVICE_NAME,
  UdpDiscoveryRequest,
  type UdpDiscoveryResponse,
} from "@rtc-database/shared/src/UdpData";
import dgram from "dgram";
import { networkInterfaces } from "node:os";

const UDP_PORT = Number(process.env.UDP_PORT) || 41234;
const UDP_MULTICAST_GROUP =
  process.env.UDP_MULTICAST_GROUP?.trim() || UDP_DISCOVERY_MULTICAST_GROUP;
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

let socket: dgram.Socket | null = null;
let joinedMulticastInterfaces: string[] = [];

const getAdvertisedHost = (): string => {
  const configuredHost = process.env.UDP_ADVERTISED_HOST?.trim();
  console.log(`[udp] Configured advertised host: ${configuredHost || "none"}`);
  if (configuredHost) {
    return configuredHost;
  }

  const interfaces = networkInterfaces();

  for (const ifaceList of Object.values(interfaces)) {
    if (!ifaceList) {
      continue;
    }

    const activeIpv4 = ifaceList.find(
      (iface) => iface.family === "IPv4" && !iface.internal,
    );

    if (activeIpv4?.address) {
      return activeIpv4.address;
    }
  }

  return "127.0.0.1";
};

const getActiveIpv4Addresses = (): string[] => {
  const interfaces = networkInterfaces();
  const addresses = new Set<string>();

  for (const ifaceList of Object.values(interfaces)) {
    if (!ifaceList) {
      continue;
    }

    for (const iface of ifaceList) {
      if (iface.family === "IPv4" && !iface.internal) {
        addresses.add(iface.address);
      }
    }
  }

  return [...addresses];
};

const joinDiscoveryMulticastGroup = (): void => {
  if (!socket) {
    return;
  }

  joinedMulticastInterfaces = [];

  for (const interfaceAddress of getActiveIpv4Addresses()) {
    try {
      socket.addMembership(UDP_MULTICAST_GROUP, interfaceAddress);
      joinedMulticastInterfaces.push(interfaceAddress);
      console.log(
        `[udp] Joined multicast group ${UDP_MULTICAST_GROUP} on ${interfaceAddress}.`,
      );
    } catch (error) {
      console.warn(
        `[udp] Failed to join multicast group ${UDP_MULTICAST_GROUP} on ${interfaceAddress}:`,
        error,
      );
    }
  }

  if (joinedMulticastInterfaces.length === 0) {
    try {
      socket.addMembership(UDP_MULTICAST_GROUP);
      joinedMulticastInterfaces.push("default");
      console.log(
        `[udp] Joined multicast group ${UDP_MULTICAST_GROUP} on the default interface.`,
      );
    } catch (error) {
      console.error(
        `[udp] Failed to join multicast group ${UDP_MULTICAST_GROUP} on any interface:`,
        error,
      );
    }
  }
};

export function startUdpDiscoveryResponder(): void {
  if (socket) {
    return;
  }

  const advertisedHost = getAdvertisedHost();

  socket = dgram.createSocket({ type: "udp4", reuseAddr: true });

  socket.on("listening", () => {
    socket!.setMulticastTTL(UDP_DISCOVERY_MULTICAST_TTL);
    socket!.setMulticastLoopback(true);
    joinDiscoveryMulticastGroup();

    const address = socket!.address();
    console.log(
      `[udp] Discovery responder listening on ${address.address}:${address.port} (multicast=${UDP_MULTICAST_GROUP}, backend=${advertisedHost}:${ADVERTISED_PORT})`,
    );
  });

  socket.on("message", (msg, rinfo) => {
    let requestPayload: unknown;

    try {
      requestPayload = JSON.parse(msg.toString());
    } catch {
      return;
    }

    const parsedRequest = UdpDiscoveryRequest.safeParse(requestPayload);
    if (!parsedRequest.success) {
      return;
    }

    const response: UdpDiscoveryResponse = {
      type: UDP_DISCOVERY_RESPONSE_TYPE,
      service: UDP_SERVICE_NAME,
      protocol: ADVERTISED_PROTOCOL,
      host: advertisedHost,
      port: ADVERTISED_PORT,
      timestamp: Date.now(),
    };

    socket?.send(
      Buffer.from(JSON.stringify(response)),
      rinfo.port,
      rinfo.address,
      (error) => {
        if (error) {
          console.error("[udp] Failed to send discovery response:", error);
          return;
        }

        console.log(
          `[udp] Responded to ${UDP_DISCOVERY_REQUEST_TYPE} from ${rinfo.address}:${rinfo.port}`,
        );
      },
    );
  });

  socket.on("error", (error) => {
    console.error("[udp] Discovery responder error:", error);
  });

  socket.bind(UDP_PORT, "0.0.0.0");
}

export function stopUdpDiscoveryResponder(): void {
  if (socket) {
    socket.close();
    socket = null;
  }

  joinedMulticastInterfaces = [];

  console.log("[udp] Discovery responder stopped");
}
