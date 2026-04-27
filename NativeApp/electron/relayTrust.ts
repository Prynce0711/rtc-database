import { app, session } from "electron";
import type { BackendInfo } from "@rtc-database/shared/src/UdpData";
import { X509Certificate } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import tls from "node:tls";

export type RelayCertificatePin = {
  fingerprint256: string;
  hostname?: string;
  port?: number;
  establishedAt?: string;
  subjectName?: string;
  issuerName?: string;
};

type RelayTrustStore = {
  version: 1;
  relay?: RelayCertificatePin;
};

const RELAY_TRUST_STORE_FILENAME = "relay-trust-store.json";
const RELAY_CERTIFICATE_PROBE_TIMEOUT_MS = 4000;

export const normalizeFingerprint = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  const withoutPrefix = trimmed.startsWith("sha256/")
    ? trimmed.slice(7)
    : trimmed;
  const withoutSeparators = withoutPrefix.replace(/:/g, "");

  if (/^[0-9a-f]+$/.test(withoutSeparators)) {
    return withoutSeparators;
  }

  const decoded = Buffer.from(withoutSeparators, "base64");
  if (decoded.length === 32) {
    return decoded.toString("hex");
  }

  return withoutSeparators;
};

export const isLocalRelayHost = (hostname: string): boolean => {
  const normalizedHost = hostname.trim().toLowerCase();

  if (
    normalizedHost === "localhost" ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "::1"
  ) {
    return true;
  }

  if (normalizedHost.endsWith(".local") || normalizedHost.endsWith(".lan")) {
    return true;
  }

  if (normalizedHost.includes(":")) {
    return normalizedHost.startsWith("fc") || normalizedHost.startsWith("fd");
  }

  const octets = normalizedHost.split(".").map((value) => Number(value));
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value))) {
    return false;
  }

  const [first, second] = octets;
  if (first === 10) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  if (first === 169 && second === 254) return true;

  return false;
};

const getRelayTrustStorePath = (): string =>
  path.join(app.getPath("userData"), RELAY_TRUST_STORE_FILENAME);

const sanitizeRelayCertificatePin = (
  relay: RelayCertificatePin,
): RelayCertificatePin => ({
  fingerprint256: normalizeFingerprint(relay.fingerprint256),
  hostname:
    typeof relay.hostname === "string" && relay.hostname.trim()
      ? relay.hostname.trim().toLowerCase()
      : undefined,
  port:
    typeof relay.port === "number" &&
    Number.isInteger(relay.port) &&
    relay.port > 0
      ? relay.port
      : undefined,
  establishedAt:
    typeof relay.establishedAt === "string" && relay.establishedAt.trim()
      ? relay.establishedAt
      : undefined,
  subjectName:
    typeof relay.subjectName === "string" && relay.subjectName.trim()
      ? relay.subjectName.trim()
      : undefined,
  issuerName:
    typeof relay.issuerName === "string" && relay.issuerName.trim()
      ? relay.issuerName.trim()
      : undefined,
});

const loadRelayTrustStore = (): RelayTrustStore | null => {
  try {
    const rawContent = fs.readFileSync(getRelayTrustStorePath(), "utf8");
    const parsed = JSON.parse(rawContent) as Partial<RelayTrustStore>;

    if (parsed.version === 1 && parsed.relay?.fingerprint256) {
      return {
        version: 1,
        relay: sanitizeRelayCertificatePin(parsed.relay),
      };
    }
  } catch {
    // No trust store yet.
  }

  return null;
};

const saveRelayTrustStore = (store: RelayTrustStore): void => {
  const storePath = getRelayTrustStorePath();
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
};

export const getPinnedRelayCertificatePin = (): RelayCertificatePin | null => {
  const store = loadRelayTrustStore();
  return store?.relay ?? null;
};

export const getPinnedRelayFingerprint = (): string | null => {
  return getPinnedRelayCertificatePin()?.fingerprint256 ?? null;
};

export const savePinnedRelayCertificatePin = (
  relay: RelayCertificatePin,
): RelayCertificatePin => {
  const sanitizedRelay = sanitizeRelayCertificatePin(relay);

  saveRelayTrustStore({
    version: 1,
    relay: sanitizedRelay,
  });

  return sanitizedRelay;
};

const getCertificateFingerprint256 = (certificate: unknown): string | null => {
  if (!certificate || typeof certificate !== "object") {
    return null;
  }

  const candidate = certificate as {
    data?: unknown;
    fingerprint256?: unknown;
    fingerprint?: unknown;
  };

  if (typeof candidate.data === "string" || Buffer.isBuffer(candidate.data)) {
    try {
      return normalizeFingerprint(
        new X509Certificate(candidate.data).fingerprint256,
      );
    } catch {
      return null;
    }
  }

  if (typeof candidate.fingerprint256 === "string") {
    return normalizeFingerprint(candidate.fingerprint256);
  }

  if (typeof candidate.fingerprint === "string") {
    return normalizeFingerprint(candidate.fingerprint);
  }

  return null;
};

const formatCertificateName = (value: unknown): string | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const commonName = typeof record.CN === "string" ? record.CN.trim() : "";

  if (commonName) {
    return commonName;
  }

  const parts = Object.entries(record)
    .filter(([, partValue]) => typeof partValue === "string" && partValue.trim())
    .map(([key, partValue]) => `${key}=${String(partValue).trim()}`);

  return parts.length > 0 ? parts.join(", ") : undefined;
};

export const inspectLocalRelayCertificate = async (
  hostname: string,
  port: number,
): Promise<
  | {
      fingerprint256: string | null;
      subjectName?: string;
      issuerName?: string;
    }
  | null
> => {
  if (
    !hostname.trim() ||
    !Number.isInteger(port) ||
    port <= 0 ||
    !isLocalRelayHost(hostname)
  ) {
    return null;
  }

  return new Promise((resolve) => {
    let settled = false;
    const socket = tls.connect({
      host: hostname,
      port,
      rejectUnauthorized: false,
      servername: net.isIP(hostname) ? undefined : hostname,
    });

    const finish = (
      result:
        | {
            fingerprint256: string | null;
            subjectName?: string;
            issuerName?: string;
          }
        | null,
    ) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.removeAllListeners();

      if (!socket.destroyed) {
        socket.destroy();
      }

      resolve(result);
    };

    socket.setTimeout(RELAY_CERTIFICATE_PROBE_TIMEOUT_MS);

    socket.once("secureConnect", () => {
      const peerCertificate = socket.getPeerCertificate(true);

      finish({
        fingerprint256: getCertificateFingerprint256(peerCertificate),
        subjectName: formatCertificateName(peerCertificate?.subject),
        issuerName: formatCertificateName(peerCertificate?.issuer),
      });
    });

    socket.once("timeout", () => {
      finish(null);
    });

    socket.once("error", () => {
      finish(null);
    });
  });
};

export type BackendTrustAssessment = Pick<
  BackendInfo,
  | "relayFingerprint256"
  | "relaySubjectName"
  | "relayIssuerName"
  | "pinnedRelayFingerprint256"
  | "usualRelayHostname"
  | "usualRelayPort"
  | "relayTrustState"
  | "relayWarningKind"
  | "isPreferred"
>;

export const inspectBackendTrust = async (
  backendUrl: string,
): Promise<BackendTrustAssessment> => {
  const pinnedRelay = getPinnedRelayCertificatePin();
  const pinnedRelayFingerprint256 = pinnedRelay?.fingerprint256 ?? null;
  const assessment: BackendTrustAssessment = {
    relayFingerprint256: null,
    relaySubjectName: null,
    relayIssuerName: null,
    pinnedRelayFingerprint256,
    usualRelayHostname: pinnedRelay?.hostname ?? null,
    usualRelayPort: pinnedRelay?.port ?? null,
    relayTrustState: pinnedRelay ? "unverified" : "new",
    relayWarningKind: pinnedRelay ? "unverified" : null,
    isPreferred: !pinnedRelay,
  };

  try {
    const parsedBackendUrl = new URL(backendUrl);
    const isHttpsBackend = parsedBackendUrl.protocol === "https:";
    const backendPort = Number(parsedBackendUrl.port) || 443;

    if (isHttpsBackend) {
      const certificate = await inspectLocalRelayCertificate(
        parsedBackendUrl.hostname,
        backendPort,
      );

      if (certificate) {
        assessment.relayFingerprint256 = certificate.fingerprint256;
        assessment.relaySubjectName = certificate.subjectName ?? null;
        assessment.relayIssuerName = certificate.issuerName ?? null;
      }
    }

    if (!pinnedRelay) {
      assessment.relayTrustState = "new";
      assessment.relayWarningKind = null;
      assessment.isPreferred = true;
      return assessment;
    }

    if (
      assessment.relayFingerprint256 &&
      assessment.relayFingerprint256 === pinnedRelayFingerprint256
    ) {
      assessment.relayTrustState = "trusted";
      assessment.relayWarningKind = null;
      assessment.isPreferred = true;
      return assessment;
    }

    assessment.isPreferred = false;

    if (!isHttpsBackend || !assessment.relayFingerprint256) {
      assessment.relayTrustState = "unverified";
      assessment.relayWarningKind = "unverified";
      return assessment;
    }

    assessment.relayTrustState = "changed";
    assessment.relayWarningKind =
      pinnedRelay.hostname === parsedBackendUrl.hostname &&
      pinnedRelay.port === backendPort
        ? "certificate-changed"
        : "different-backend";

    return assessment;
  } catch {
    return assessment;
  }
};

export const configureRelayCertificatePinning = (): void => {
  session.defaultSession.setCertificateVerifyProc((request, callback) => {
    const hostname = request.hostname.trim();

    if (!isLocalRelayHost(hostname)) {
      callback(-3);
      return;
    }

    const fingerprint256 = getCertificateFingerprint256(request.certificate);

    if (!fingerprint256) {
      console.error(
        `[relay-pin] Unable to read certificate fingerprint for ${hostname}.`,
      );
      callback(-2);
      return;
    }

    const store = loadRelayTrustStore() ?? { version: 1 };
    const pinnedRelay = store.relay;

    if (!pinnedRelay) {
      store.relay = savePinnedRelayCertificatePin({
        fingerprint256,
        hostname,
        port: Number((request as { port?: number }).port) || 0,
        establishedAt: new Date().toISOString(),
        subjectName:
          typeof request.certificate?.subjectName === "string"
            ? request.certificate.subjectName
            : undefined,
        issuerName:
          typeof request.certificate?.issuerName === "string"
            ? request.certificate.issuerName
            : undefined,
      });
      console.log(
        `[relay-pin] Trusted relay certificate for ${hostname} on first use.`,
      );
      callback(0);
      return;
    }

    if (pinnedRelay.fingerprint256 === fingerprint256) {
      callback(0);
      return;
    }

    console.error(
      `[relay-pin] Certificate mismatch for ${hostname}: expected ${pinnedRelay.fingerprint256}, received ${fingerprint256}.`,
    );
    callback(-2);
  });
};
