import { z } from "zod";
export declare const UDP_SERVICE_NAME = "rtc-backend";
export declare const UDP_DISCOVERY_REQUEST_TYPE = "DISCOVER_BACKEND";
export declare const UDP_DISCOVERY_RESPONSE_TYPE = "BACKEND_AVAILABLE";
export declare const UDP_DISCOVERY_PORT = 41234;
export declare const UDP_DISCOVERY_MULTICAST_GROUP = "239.255.67.89";
export declare const UDP_DISCOVERY_MULTICAST_TTL = 1;
export declare const RELAY_HEALTH_PATH = "/_rtc/relay-health";
export declare const RELAY_BACKEND_HEALTH_PATH = "/_rtc/backend-health";
export declare const UdpDiscoveryRequest: z.ZodObject<{
    type: z.ZodLiteral<"DISCOVER_BACKEND">;
    service: z.ZodLiteral<"rtc-backend">;
    timestamp: z.ZodNumber;
}, z.core.$strip>;
export type UdpDiscoveryRequest = z.infer<typeof UdpDiscoveryRequest>;
export declare const UdpDiscoveryResponse: z.ZodObject<{
    type: z.ZodLiteral<"BACKEND_AVAILABLE">;
    service: z.ZodLiteral<"rtc-backend">;
    protocol: z.ZodOptional<z.ZodEnum<{
        http: "http";
        https: "https";
    }>>;
    host: z.ZodString;
    hosts: z.ZodOptional<z.ZodArray<z.ZodString>>;
    port: z.ZodNumber;
    timestamp: z.ZodNumber;
}, z.core.$strip>;
export type UdpDiscoveryResponse = z.infer<typeof UdpDiscoveryResponse>;
export declare const UdpData: z.ZodObject<{
    type: z.ZodLiteral<"BACKEND_AVAILABLE">;
    service: z.ZodLiteral<"rtc-backend">;
    protocol: z.ZodOptional<z.ZodEnum<{
        http: "http";
        https: "https";
    }>>;
    host: z.ZodString;
    hosts: z.ZodOptional<z.ZodArray<z.ZodString>>;
    port: z.ZodNumber;
    timestamp: z.ZodNumber;
}, z.core.$strip>;
export type UdpData = UdpDiscoveryResponse;
export type RelayTrustState = "trusted" | "new" | "changed" | "unverified";
export type RelayWarningKind = "certificate-changed" | "different-backend" | "unverified" | null;
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
