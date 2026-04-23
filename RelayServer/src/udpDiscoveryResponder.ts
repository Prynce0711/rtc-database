import {
  UDP_DISCOVERY_REQUEST_TYPE,
  UDP_DISCOVERY_RESPONSE_TYPE,
  UDP_SERVICE_NAME,
  UdpDiscoveryRequest,
  type UdpDiscoveryResponse,
} from "@rtc-database/shared/src/UdpData";
import dgram from "dgram";
import { networkInterfaces } from "node:os";

const UDP_PORT = Number(process.env.UDP_PORT) || 41234;
const ADVERTISED_PORT =
  Number(process.env.UDP_ADVERTISED_PORT) ||
  Number(process.env.RELAY_PORT) ||
  Number(process.env.BACKEND_PORT) ||
  3000;

let socket: dgram.Socket | null = null;

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

export function startUdpDiscoveryResponder(): void {
  if (socket) {
    return;
  }

  const advertisedHost = getAdvertisedHost();

  socket = dgram.createSocket("udp4");

  socket.on("listening", () => {
    const address = socket!.address();
    console.log(
      `[udp] Discovery responder listening on ${address.address}:${address.port} (backend=${advertisedHost}:${ADVERTISED_PORT})`,
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

  socket.bind(UDP_PORT);
}

export function stopUdpDiscoveryResponder(): void {
  if (socket) {
    socket.close();
    socket = null;
  }

  console.log("[udp] Discovery responder stopped");
}
