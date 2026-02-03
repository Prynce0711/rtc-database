import { z } from "zod";

export const UDP_SERVICE_NAME = "rtc-backend";

export const UdpData = z.object({
  service: z.literal(UDP_SERVICE_NAME),
  port: z.number().int().min(1).max(65535),
  timestamp: z.number().int().min(0),
});
export type UdpData = z.infer<typeof UdpData>;

export type BackendInfo = {
  url: string;
  ip: string;
  port: number;
  lastSeen: number;
};
