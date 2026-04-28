import { z } from "zod";

export const UDP_SERVICE_NAME = "rtc-backend";
export const UDP_DISCOVERY_REQUEST_TYPE = "DISCOVER_BACKEND";
export const UDP_DISCOVERY_RESPONSE_TYPE = "BACKEND_AVAILABLE";
export const UDP_DISCOVERY_MULTICAST_GROUP = "239.255.67.89";
export const UDP_DISCOVERY_MULTICAST_TTL = 1;
export const RELAY_HEALTH_PATH = "/_rtc/relay-health";

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
  hosts: z.array(z.string().min(1)).min(1).optional(),
  port: z.number().int().min(1).max(65535),
  timestamp: z.number().int().min(0),
});
export type UdpDiscoveryResponse = z.infer<typeof UdpDiscoveryResponse>;

// Backward-compat alias used in existing imports.
export const UdpData = UdpDiscoveryResponse;
export type UdpData = UdpDiscoveryResponse;

export type RelayTrustState =
  | "trusted"
  | "new"
  | "changed"
  | "unverified";

export type RelayWarningKind =
  | "certificate-changed"
  | "different-backend"
  | "unverified"
  | null;

export type BackendInfo = {
  url: string;
  ip: string;
  port: number;
  lastSeen: number;
  relayFingerprint256?: string | null;
  relaySubjectName?: string | null;
  relayIssuerName?: string | null;
  pinnedRelayFingerprint256?: string | null;
  usualRelayHostname?: string | null;
  usualRelayProtocol?: "http" | "https" | null;
  usualRelayPort?: number | null;
  usualRelayReachable?: boolean | null;
  relayTrustState?: RelayTrustState;
  relayWarningKind?: RelayWarningKind;
  isPreferred?: boolean;
};
