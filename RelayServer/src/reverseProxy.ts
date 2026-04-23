import httpProxy from "http-proxy";
import { randomUUID } from "node:crypto";
import http from "node:http";
import { URL } from "node:url";

const RELAY_HOP_HEADER = "x-rtc-relay-hop";
const RELAY_HOP_TOKEN_HEADER = "x-rtc-relay-hop-token";
const MAX_RELAY_HOPS = 1;
const RELAY_HOP_RUNTIME_TOKEN = randomUUID();

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

type RelayRequest = http.IncomingMessage & {
  relayHopCount?: number;
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

const parseRelayHop = (headerValue: string | string[] | undefined): number => {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const parsed = Number(raw);
  if (Number.isInteger(parsed) && parsed >= 0) {
    return parsed;
  }

  return 0;
};

const readHeaderValue = (
  headers: http.IncomingHttpHeaders,
  name: string,
): string | undefined => {
  const raw = headers[name];
  if (typeof raw === "string") {
    return raw;
  }

  if (Array.isArray(raw)) {
    return raw[0];
  }

  return undefined;
};

const stripRelayHeaders = (headers: http.IncomingHttpHeaders): void => {
  delete headers[RELAY_HOP_HEADER];
  delete headers[RELAY_HOP_TOKEN_HEADER];
};

const getTrustedRelayHop = (headers: http.IncomingHttpHeaders): number => {
  const token = readHeaderValue(headers, RELAY_HOP_TOKEN_HEADER);
  if (token !== RELAY_HOP_RUNTIME_TOKEN) {
    return 0;
  }

  return parseRelayHop(readHeaderValue(headers, RELAY_HOP_HEADER));
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

  proxy.on("proxyReq", (proxyReq, request) => {
    const relayRequest = request as RelayRequest;
    const hopCount = relayRequest.relayHopCount ?? 0;

    proxyReq.removeHeader(RELAY_HOP_HEADER);
    proxyReq.removeHeader(RELAY_HOP_TOKEN_HEADER);
    proxyReq.setHeader(RELAY_HOP_HEADER, String(hopCount + 1));
    proxyReq.setHeader(RELAY_HOP_TOKEN_HEADER, RELAY_HOP_RUNTIME_TOKEN);
  });

  proxy.on("proxyReqWs", (proxyReq, request) => {
    const relayRequest = request as RelayRequest;
    const hopCount = relayRequest.relayHopCount ?? 0;

    proxyReq.removeHeader(RELAY_HOP_HEADER);
    proxyReq.removeHeader(RELAY_HOP_TOKEN_HEADER);
    proxyReq.setHeader(RELAY_HOP_HEADER, String(hopCount + 1));
    proxyReq.setHeader(RELAY_HOP_TOKEN_HEADER, RELAY_HOP_RUNTIME_TOKEN);
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
    const relayRequest = request as RelayRequest;
    relayRequest.relayHopCount = getTrustedRelayHop(request.headers);
    stripRelayHeaders(request.headers);

    const hopCount = relayRequest.relayHopCount;
    if (hopCount >= MAX_RELAY_HOPS) {
      console.error(
        `[relay] Loop detected for ${request.method ?? "UNKNOWN"} ${request.url ?? ""}. Check RELAY_TARGET_URL.`,
      );
      response.writeHead(508, {
        "Content-Type": "application/json",
      });
      response.end(
        JSON.stringify({
          error: "Relay loop detected",
          detail: "RELAY_TARGET_URL points back to relay itself.",
        }),
      );
      return;
    }

    proxy?.web(request, response);
  });

  server.on("upgrade", (request, socket, head) => {
    const relayRequest = request as RelayRequest;
    relayRequest.relayHopCount = getTrustedRelayHop(request.headers);
    stripRelayHeaders(request.headers);

    const hopCount = relayRequest.relayHopCount;
    if (hopCount >= MAX_RELAY_HOPS) {
      console.error(
        `[relay] WebSocket loop detected for ${request.url ?? ""}. Check RELAY_TARGET_URL.`,
      );
      socket.write("HTTP/1.1 508 Loop Detected\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

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
