import "dotenv/config";
import { startReverseProxy, stopReverseProxy } from "./reverseProxy";
import {
  startUdpDiscoveryResponder,
  stopUdpDiscoveryResponder,
} from "./udpDiscoveryResponder";

async function startRelayServices(): Promise<void> {
  startReverseProxy();
  startUdpDiscoveryResponder();

  console.log(
    `> Relay services started (env=${process.env.NODE_ENV ?? "development"})`,
  );
}

function registerShutdownHooks(): void {
  const shutdown = () => {
    stopUdpDiscoveryResponder();
    stopReverseProxy();
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void startRelayServices().catch((error: unknown) => {
  console.error("Failed to start relay services:", error);
  process.exit(1);
});

registerShutdownHooks();
