"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UdpData = exports.UdpDiscoveryResponse = exports.UdpDiscoveryRequest = exports.RELAY_BACKEND_HEALTH_PATH = exports.RELAY_HEALTH_PATH = exports.UDP_DISCOVERY_MULTICAST_TTL = exports.UDP_DISCOVERY_MULTICAST_GROUP = exports.UDP_DISCOVERY_PORT = exports.UDP_DISCOVERY_RESPONSE_TYPE = exports.UDP_DISCOVERY_REQUEST_TYPE = exports.UDP_SERVICE_NAME = void 0;
const zod_1 = require("zod");
exports.UDP_SERVICE_NAME = "rtc-backend";
exports.UDP_DISCOVERY_REQUEST_TYPE = "DISCOVER_BACKEND";
exports.UDP_DISCOVERY_RESPONSE_TYPE = "BACKEND_AVAILABLE";
exports.UDP_DISCOVERY_PORT = 41234;
exports.UDP_DISCOVERY_MULTICAST_GROUP = "239.255.67.89";
exports.UDP_DISCOVERY_MULTICAST_TTL = 1;
exports.RELAY_HEALTH_PATH = "/_rtc/relay-health";
exports.RELAY_BACKEND_HEALTH_PATH = "/_rtc/backend-health";
exports.UdpDiscoveryRequest = zod_1.z.object({
    type: zod_1.z.literal(exports.UDP_DISCOVERY_REQUEST_TYPE),
    service: zod_1.z.literal(exports.UDP_SERVICE_NAME),
    timestamp: zod_1.z.number().int().min(0),
});
exports.UdpDiscoveryResponse = zod_1.z.object({
    type: zod_1.z.literal(exports.UDP_DISCOVERY_RESPONSE_TYPE),
    service: zod_1.z.literal(exports.UDP_SERVICE_NAME),
    protocol: zod_1.z.enum(["http", "https"]).optional(),
    host: zod_1.z.string().min(1),
    hosts: zod_1.z.array(zod_1.z.string().min(1)).min(1).optional(),
    port: zod_1.z.number().int().min(1).max(65535),
    timestamp: zod_1.z.number().int().min(0),
});
// Backward-compat alias used in existing imports.
exports.UdpData = exports.UdpDiscoveryResponse;
//# sourceMappingURL=index.js.map