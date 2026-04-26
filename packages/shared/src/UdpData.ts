import { z } from "zod";

export const UDP_SERVICE_NAME = "rtc-backend";
export const UDP_DISCOVERY_REQUEST_TYPE = "DISCOVER_BACKEND";
export const UDP_DISCOVERY_RESPONSE_TYPE = "BACKEND_AVAILABLE";

export const UdpDiscoveryRequest = z.object({
  type: z.literal(UDP_DISCOVERY_REQUEST_TYPE),
  service: z.literal(UDP_SERVICE_NAME),
  timestamp: z.number().int().min(0),
});
export type UdpDiscoveryRequest = z.infer<typeof UdpDiscoveryRequest>;

export const UdpDiscoveryResponse = z.object({
  type: z.literal(UDP_DISCOVERY_RESPONSE_TYPE),
  service: z.literal(UDP_SERVICE_NAME),
  protocol: z.enum(["http", "https"]).optional(),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  timestamp: z.number().int().min(0),
});
export type UdpDiscoveryResponse = z.infer<typeof UdpDiscoveryResponse>;

// Backward-compat alias used in existing imports.
export const UdpData = UdpDiscoveryResponse;
export type UdpData = UdpDiscoveryResponse;

export type BackendInfo = {
  url: string;
  ip: string;
  port: number;
  lastSeen: number;
};
