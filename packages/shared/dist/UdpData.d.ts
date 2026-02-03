import { z } from "zod";
export declare const UDP_SERVICE_NAME = "rtc-backend";
export declare const UdpData: z.ZodObject<{
    service: z.ZodLiteral<"rtc-backend">;
    port: z.ZodNumber;
    timestamp: z.ZodNumber;
}, z.core.$strip>;
export type UdpData = z.infer<typeof UdpData>;
export type BackendInfo = {
    url: string;
    ip: string;
    port: number;
    lastSeen: number;
};
//# sourceMappingURL=UdpData.d.ts.map