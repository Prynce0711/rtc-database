import { RELAY_HEALTH_PATH } from "@rtc-database/shared/src/UdpData";
import httpProxy from "http-proxy";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { URL } from "node:url";
import selfsigned from "selfsigned";

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
  originOverride: URL | null;
  insecureTls: boolean;
  useHttps: boolean;
  tlsCertPath: string;
  tlsKeyPath: string;
  tlsAutoGenerate: boolean;
  tlsCertHosts: string[];
};

type RelayRequest = http.IncomingMessage & {
  relayHopCount?: number;
};

const getForwardedProto = (request: http.IncomingMessage): "http" | "https" => {
  const socket = request.socket as { encrypted?: boolean };
  return socket.encrypted ? "https" : "http";
};

const getForwardedPort = (
  hostHeader: string | undefined,
  fallbackPort: number,
): string => {
  if (!hostHeader) {
    return String(fallbackPort);
  }

  const hostParts = hostHeader.split(":");
  if (hostParts.length > 1) {
    const candidatePort = hostParts[hostParts.length - 1];
    const parsed = Number(candidatePort);
    if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
      return String(parsed);
    }
  }

  return String(fallbackPort);
};

type TrustStore = {
  version: 1;
  upstreams: Record<
    string,
    {
      fingerprint256: string;
      firstSeenAt: string;
      lastSeenAt: string;
      host: string;
    }
  >;
};

const parseBoolean = (
  value: string | undefined,
  fallback: boolean,
): boolean => {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }

  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }

  return fallback;
};

const resolvePath = (rawPath: string): string =>
  path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);

const parseOriginOverride = (
  enabledRaw: string | undefined,
  originRaw: string | undefined,
  fallbackRaw: string,
): URL | null => {
  if (!parseBoolean(enabledRaw, false)) {
    return null;
  }

  const configuredOrigin = originRaw?.trim() || fallbackRaw;

  const parsedOrigin = new URL(configuredOrigin);
  if (parsedOrigin.protocol !== "http:" && parsedOrigin.protocol !== "https:") {
    throw new Error(
      "RELAY_OVERRIDE_ORIGIN_URL or RELAY_TARGET_URL must start with http:// or https://",
    );
  }

  return parsedOrigin;
};

const parseTlsCertHosts = (
  rawHosts: string | undefined,
  listenHost: string,
): string[] => {
  const defaults = ["localhost", "127.0.0.1"];
  const configured =
    rawHosts
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];

  if (listenHost !== "0.0.0.0") {
    configured.push(listenHost);
  }

  return Array.from(new Set([...defaults, ...configured]));
};

const ensureTlsCertificate = async (
  config: RelayConfig,
): Promise<{ key: string; cert: string }> => {
  const keyExists = fs.existsSync(config.tlsKeyPath);
  const certExists = fs.existsSync(config.tlsCertPath);

  if (!keyExists || !certExists) {
    if (!config.tlsAutoGenerate) {
      throw new Error(
        `TLS certificate/key not found. Provide files at ${config.tlsCertPath} and ${config.tlsKeyPath}, or enable RELAY_TLS_AUTO_GENERATE=true.`,
      );
    }

    const altNames: Array<
      { type: 2; value: string } | { type: 7; ip: string }
    > = config.tlsCertHosts.map((host) => {
      const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
      return isIp
        ? ({ type: 7, ip: host } as const)
        : ({ type: 2, value: host } as const);
    });

    const pems = await selfsigned.generate(
      [{ name: "commonName", value: config.tlsCertHosts[0] ?? "localhost" }],
      {
        keySize: 2048,
        notAfterDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        algorithm: "sha256",
        extensions: [{ name: "subjectAltName", altNames }],
      },
    );

    fs.mkdirSync(path.dirname(config.tlsKeyPath), { recursive: true });
    fs.mkdirSync(path.dirname(config.tlsCertPath), { recursive: true });
    fs.writeFileSync(config.tlsKeyPath, pems.private, "utf8");
    fs.writeFileSync(config.tlsCertPath, pems.cert, "utf8");

    console.log(
      `[relay] Generated self-signed TLS certificate at ${config.tlsCertPath}.`,
    );
  }

  return {
    key: fs.readFileSync(config.tlsKeyPath, "utf8"),
    cert: fs.readFileSync(config.tlsCertPath, "utf8"),
  };
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

  const listenHost = process.env.RELAY_LISTEN_HOST?.trim() || "0.0.0.0";
  const useHttps = parseBoolean(process.env.RELAY_USE_HTTPS, false);
  const originOverride = parseOriginOverride(
    process.env.RELAY_OVERRIDE_ORIGIN,
    process.env.RELAY_OVERRIDE_ORIGIN_URL,
    targetUrl,
  );
  const tlsBasePath = resolvePath(
    process.env.RELAY_TLS_DIR?.trim() || ".relay-tls",
  );
  const tlsKeyPath = resolvePath(
    process.env.RELAY_TLS_KEY_PATH?.trim() ||
      path.join(tlsBasePath, "relay.key"),
  );
  const tlsCertPath = resolvePath(
    process.env.RELAY_TLS_CERT_PATH?.trim() ||
      path.join(tlsBasePath, "relay.crt"),
  );

  return {
    listenHost,
    listenPort: toPort(
      process.env.RELAY_PORT ?? process.env.BACKEND_PORT,
      3000,
    ),
    targetUrl,
    originOverride,
    insecureTls: parseBoolean(process.env.RELAY_INSECURE_TLS, false),
    useHttps,
    tlsKeyPath,
    tlsCertPath,
    tlsAutoGenerate: parseBoolean(process.env.RELAY_TLS_AUTO_GENERATE, true),
    tlsCertHosts: parseTlsCertHosts(
      process.env.RELAY_TLS_CERT_HOSTS,
      listenHost,
    ),
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

const getPortForUrl = (url: URL): string =>
  url.port || (url.protocol === "https:" ? "443" : "80");

const applyOriginForwarding = (
  proxyReq: http.ClientRequest,
  request: http.IncomingMessage,
  config: RelayConfig,
): void => {
  const originalHost = readHeaderValue(request.headers, "host");
  const originalProto = getForwardedProto(request);
  const originalPort = getForwardedPort(originalHost, config.listenPort);
  const hasOriginHeader = !!readHeaderValue(request.headers, "origin");
  const forwardedOrigin =
    hasOriginHeader && config.originOverride ? config.originOverride : null;

  const forwardedHost = forwardedOrigin?.host ?? originalHost;
  const forwardedProto =
    forwardedOrigin?.protocol === "https:"
      ? "https"
      : forwardedOrigin?.protocol === "http:"
        ? "http"
        : originalProto;
  const forwardedPort = forwardedOrigin
    ? getPortForUrl(forwardedOrigin)
    : originalPort;

  if (forwardedOrigin) {
    proxyReq.setHeader("origin", forwardedOrigin.origin);
  }

  if (forwardedHost) {
    proxyReq.setHeader("x-forwarded-host", forwardedHost);
  }
  proxyReq.setHeader("x-forwarded-proto", forwardedProto);
  proxyReq.setHeader("x-forwarded-port", forwardedPort);
};

let proxy: httpProxy | null = null;
let server: http.Server | https.Server | null = null;

export async function startReverseProxy(): Promise<void> {
  if (proxy || server) {
    return;
  }

  const config = resolveRelayConfig();
  const target = new URL(config.targetUrl);
  const targetProtocol = target.protocol;

  let upstreamAgent: https.Agent | undefined;
  if (targetProtocol === "https:") {
    upstreamAgent = new https.Agent({
      keepAlive: true,
      rejectUnauthorized: !config.insecureTls,
    });
  }

  proxy = httpProxy.createProxyServer({
    target: config.targetUrl,
    changeOrigin: true,
    ws: true,
    xfwd: true,
    secure: targetProtocol === "https:" ? !config.insecureTls : true,
    ...(upstreamAgent ? { agent: upstreamAgent } : {}),
  });

  proxy.on("proxyReq", (proxyReq, request) => {
    const relayRequest = request as RelayRequest;
    const hopCount = relayRequest.relayHopCount ?? 0;

    proxyReq.removeHeader(RELAY_HOP_HEADER);
    proxyReq.removeHeader(RELAY_HOP_TOKEN_HEADER);
    proxyReq.setHeader(RELAY_HOP_HEADER, String(hopCount + 1));
    proxyReq.setHeader(RELAY_HOP_TOKEN_HEADER, RELAY_HOP_RUNTIME_TOKEN);

    // Keep forwarded host/proto aligned with the effective Origin so Next Server Actions validation passes.
    applyOriginForwarding(proxyReq, request, config);
  });

  proxy.on("proxyReqWs", (proxyReq, request) => {
    const relayRequest = request as RelayRequest;
    const hopCount = relayRequest.relayHopCount ?? 0;

    proxyReq.removeHeader(RELAY_HOP_HEADER);
    proxyReq.removeHeader(RELAY_HOP_TOKEN_HEADER);
    proxyReq.setHeader(RELAY_HOP_HEADER, String(hopCount + 1));
    proxyReq.setHeader(RELAY_HOP_TOKEN_HEADER, RELAY_HOP_RUNTIME_TOKEN);

    applyOriginForwarding(proxyReq, request, config);
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

const requestHandler: http.RequestListener = (request, response) => {
    const requestPath = request.url
      ? new URL(request.url, "http://relay.local").pathname
      : "";

    if (requestPath === RELAY_HEALTH_PATH) {
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      response.end(
        JSON.stringify({
          ok: true,
          relay: true,
          timestamp: Date.now(),
        }),
      );
      return;
    }

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
  };

  if (config.useHttps) {
    const tlsMaterial = await ensureTlsCertificate(config);
    server = https.createServer(
      {
        key: tlsMaterial.key,
        cert: tlsMaterial.cert,
      },
      requestHandler,
    );
  } else {
    server = http.createServer(requestHandler);
  }

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

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error & { code?: string }) => {
      server?.off("error", onError);

      if (error.code === "EADDRINUSE") {
        reject(
          new Error(
            `[relay] Cannot start reverse proxy: ${config.listenHost}:${config.listenPort} is already in use. Stop the other relay instance or change RELAY_PORT.`,
          ),
        );
        return;
      }

      reject(error);
    };

    server?.once("error", onError);
    server?.listen(config.listenPort, config.listenHost, () => {
      server?.off("error", onError);
      console.log(
        `[relay] Reverse proxy listening on ${config.useHttps ? "https" : "http"}://${config.listenHost}:${config.listenPort} -> ${config.targetUrl}`,
      );
      resolve();
    });
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
