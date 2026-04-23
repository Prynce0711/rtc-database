import httpProxy from "http-proxy";
import http from "node:http";
import { URL } from "node:url";

const toPort = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
    return parsed;
  }

  return fallback;
};

type RelayConfig = {
  listenHost: string;
  listenPort: number;
  targetUrl: string;
  insecureTls: boolean;
};

const resolveRelayConfig = (): RelayConfig => {
  const targetUrl = process.env.RELAY_TARGET_URL?.trim();
  if (!targetUrl) {
    throw new Error("RELAY_TARGET_URL is required for reverse proxy.");
  }

  const parsed = new URL(targetUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("RELAY_TARGET_URL must start with http:// or https://");
  }

  return {
    listenHost: process.env.RELAY_LISTEN_HOST?.trim() || "0.0.0.0",
    listenPort: toPort(
      process.env.RELAY_PORT ?? process.env.BACKEND_PORT,
      3000,
    ),
    targetUrl,
    insecureTls: process.env.RELAY_INSECURE_TLS === "true",
  };
};

let proxy: httpProxy | null = null;
let server: http.Server | null = null;

export function startReverseProxy(): void {
  if (proxy || server) {
    return;
  }

  const config = resolveRelayConfig();
  const targetProtocol = new URL(config.targetUrl).protocol;

  proxy = httpProxy.createProxyServer({
    target: config.targetUrl,
    changeOrigin: true,
    ws: true,
    xfwd: true,
    secure: targetProtocol === "https:" ? !config.insecureTls : true,
  });

  proxy.on("error", (error, request, responseOrSocket) => {
    console.error(
      `[relay] Reverse proxy error for ${request.method ?? "UNKNOWN"} ${request.url ?? ""}:`,
      error,
    );

    if (responseOrSocket && "writeHead" in responseOrSocket) {
      if (!responseOrSocket.headersSent) {
        responseOrSocket.writeHead(502, {
          "Content-Type": "application/json",
        });
      }

      responseOrSocket.end(
        JSON.stringify({ error: "Bad gateway", detail: String(error) }),
      );
      return;
    }

    if (responseOrSocket && "destroy" in responseOrSocket) {
      responseOrSocket.destroy();
    }
  });

  server = http.createServer((request, response) => {
    proxy?.web(request, response);
  });

  server.on("upgrade", (request, socket, head) => {
    proxy?.ws(request, socket, head);
  });

  server.listen(config.listenPort, config.listenHost, () => {
    console.log(
      `[relay] Reverse proxy listening on ${config.listenHost}:${config.listenPort} -> ${config.targetUrl}`,
    );
  });
}

export function stopReverseProxy(): void {
  if (server) {
    server.close();
    server = null;
  }

  if (proxy) {
    proxy.close();
    proxy = null;
  }

  console.log("[relay] Reverse proxy stopped");
}
