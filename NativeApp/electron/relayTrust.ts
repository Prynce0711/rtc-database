import { app, session } from "electron";
import { X509Certificate } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type RelayCertificatePin = {
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

const loadRelayTrustStore = (): RelayTrustStore | null => {
  try {
    const rawContent = fs.readFileSync(getRelayTrustStorePath(), "utf8");
    const parsed = JSON.parse(rawContent) as Partial<RelayTrustStore>;

    if (parsed.version === 1 && parsed.relay?.fingerprint256) {
      return {
        version: 1,
        relay: {
          fingerprint256: normalizeFingerprint(parsed.relay.fingerprint256),
        },
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

export const getPinnedRelayFingerprint = (): string | null => {
  const store = loadRelayTrustStore();
  return store?.relay?.fingerprint256 ?? null;
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
      store.relay = {
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
      };

      saveRelayTrustStore(store);
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
