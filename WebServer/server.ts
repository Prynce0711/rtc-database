import "dotenv/config";

import {
  startUdpDiscoveryResponder,
  stopUdpDiscoveryResponder,
} from "./app/lib/udpDiscoveryResponder";

async function startSidecarServices(): Promise<void> {
  startUdpDiscoveryResponder();

  console.log(
    `> Sidecar services started (env=${process.env.NODE_ENV ?? "development"})`,
  );
}

function registerShutdownHooks(): void {
  const shutdown = () => {
    stopUdpDiscoveryResponder();
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void startSidecarServices().catch((error: unknown) => {
  console.error("Failed to start sidecar services:", error);
  process.exit(1);
});

registerShutdownHooks();
