import { S3Client } from "@aws-sdk/client-s3";
import { createHash } from "crypto";
import "server-only";
import { loadSystemSettings } from "./systemSettings";

export type UploadResult = {
  key: string;
  type: string;
};

export type GetFileOptions = {
  inline?: boolean;
  fileName?: string;
  contentType?: string;
};

export type GarageInfo = {
  totalBytes: number;
  remainingBytes: number;
  consumedBytes: number;
  metricsUrl: string;
  fetchedAt: string;
};

let cachedGarageClient: S3Client | null = null;
let cachedSettingsHash: string | null = null;

function hashSettings(settings: {
  garageHost: string | null;
  garagePort: number | null;
  garageIsHttps: boolean;
  garageAccessKey: string | null;
  garageSecretKey: string | null;
  garageRegion: string | null;
}): string {
  const settingsString = JSON.stringify({
    host: settings.garageHost,
    port: settings.garagePort,
    isHttps: settings.garageIsHttps,
    region: settings.garageRegion,
    accessKeyId: settings.garageAccessKey,
    secretAccessKey: settings.garageSecretKey,
  });
  return createHash("sha256").update(settingsString).digest("hex");
}

export async function getGarageClient(): Promise<S3Client> {
  const settings = await loadSystemSettings();

  if (
    !settings.garageHost ||
    !settings.garageAccessKey ||
    !settings.garageSecretKey
  ) {
    throw new Error(
      "Garage configuration is incomplete. Please configure Garage settings in System Settings.",
    );
  }

  // Compute hash of current settings
  const currentHash = hashSettings(settings);

  // Return cached client if settings haven't changed
  if (cachedGarageClient && cachedSettingsHash === currentHash) {
    return cachedGarageClient;
  }

  // Settings changed or client not cached, rebuild
  const protocol = settings.garageIsHttps ? "https" : "http";
  const endpoint = `${protocol}://${settings.garageHost}:${settings.garagePort}`;
  const region = settings.garageRegion?.trim() || "garage";

  cachedGarageClient = new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId: settings.garageAccessKey,
      secretAccessKey: settings.garageSecretKey,
    },
    forcePathStyle: true, // REQUIRED for Garage
  });

  cachedSettingsHash = currentHash;

  return cachedGarageClient;
}

export async function garage() {
  return getGarageClient();
}

function parseMetricByVolume(
  metricsText: string,
  metricName: string,
): Record<string, number> {
  const valuesByVolume: Record<string, number> = {};
  const metricLine = new RegExp(
    `^${metricName}\\{[^}]*volume=\"([^\"]+)\"[^}]*\\}\\s+([0-9.eE+-]+)$`,
  );

  for (const rawLine of metricsText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(metricLine);
    if (!match) {
      continue;
    }

    const volume = match[1];
    const parsed = Number(match[2]);
    if (Number.isFinite(parsed)) {
      valuesByVolume[volume] = parsed;
    }
  }

  return valuesByVolume;
}

function pickPrimaryCapacity(valuesByVolume: Record<string, number>): number {
  if (typeof valuesByVolume.data === "number") {
    return valuesByVolume.data;
  }

  const values = Object.values(valuesByVolume).filter((value) =>
    Number.isFinite(value),
  );
  if (values.length === 0) {
    return 0;
  }

  // Use the largest volume as fallback to avoid double counting mirrored metrics.
  return Math.max(...values);
}

function parseConnectedRoleCapacity(metricsText: string): number {
  let totalCapacity = 0;
  const linePattern =
    /^cluster_layout_node_connected\{([^}]*)\}\s+([0-9.eE+-]+)$/;

  for (const rawLine of metricsText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(linePattern);
    if (!match) {
      continue;
    }

    const labels = match[1] ?? "";
    const connected = Number(match[2]);
    if (!Number.isFinite(connected) || connected < 1) {
      continue;
    }

    const capacityMatch = labels.match(/role_capacity="([0-9.eE+-]+)"/);
    if (!capacityMatch) {
      continue;
    }

    const capacity = Number(capacityMatch[1]);
    if (Number.isFinite(capacity) && capacity > 0) {
      totalCapacity += capacity;
    }
  }

  return totalCapacity;
}

function getGarageAdminBaseUrl(settings: {
  garageHost: string | null;
  garageAdminPort: number | null;
  garageIsHttps: boolean;
}): string {
  const protocol = settings.garageIsHttps ? "https" : "http";
  const port = settings.garageAdminPort ?? 3903;
  return `${protocol}://${settings.garageHost}:${port}`;
}

async function getBucketConsumedBytes(
  bucket: string,
  adminBaseUrl: string,
): Promise<number> {
  const settings = await loadSystemSettings();
  const adminToken = settings.garageAdminToken?.trim() || "";
  const adminHeaders = adminToken
    ? { Authorization: `Bearer ${adminToken}` }
    : undefined;

  const getBucketInfoByAliasResponse = await fetch(
    `${adminBaseUrl}/v2/GetBucketInfo?globalAlias=${encodeURIComponent(bucket)}`,
    {
      cache: "no-store",
      headers: adminHeaders,
    },
  );

  if (getBucketInfoByAliasResponse.ok) {
    const info = (await getBucketInfoByAliasResponse.json()) as {
      bytes?: number;
    };
    const consumedBytes = Number(info.bytes ?? 0);
    return Number.isFinite(consumedBytes) && consumedBytes > 0
      ? consumedBytes
      : 0;
  }

  // Fallback flow used by Garage Web UI: ListBuckets -> GetBucketInfo?id=...
  const listBucketsResponse = await fetch(`${adminBaseUrl}/v2/ListBuckets`, {
    cache: "no-store",
    headers: adminHeaders,
  });

  if (!listBucketsResponse.ok) {
    throw new Error(
      `Failed to fetch buckets from Garage admin API (${listBucketsResponse.status} ${listBucketsResponse.statusText}).`,
    );
  }

  const buckets = (await listBucketsResponse.json()) as Array<{
    id: string;
    globalAliases?: string[];
  }>;

  const matchedBucket = buckets.find((bucketInfo) =>
    (bucketInfo.globalAliases ?? []).includes(bucket),
  );

  if (!matchedBucket) {
    throw new Error(
      `Bucket \"${bucket}\" not found in Garage admin API ListBuckets response.`,
    );
  }

  const getBucketInfoByIdResponse = await fetch(
    `${adminBaseUrl}/v2/GetBucketInfo?id=${encodeURIComponent(matchedBucket.id)}`,
    {
      cache: "no-store",
      headers: adminHeaders,
    },
  );

  if (!getBucketInfoByIdResponse.ok) {
    throw new Error(
      `Failed to fetch bucket info from Garage admin API (${getBucketInfoByIdResponse.status} ${getBucketInfoByIdResponse.statusText}).`,
    );
  }

  const infoById = (await getBucketInfoByIdResponse.json()) as {
    bytes?: number;
  };
  const consumedById = Number(infoById.bytes ?? 0);
  return Number.isFinite(consumedById) && consumedById > 0 ? consumedById : 0;
}

export async function getInfo(bucket: string): Promise<GarageInfo> {
  if (!bucket || !String(bucket).trim()) {
    throw new Error("Garage bucket must be selected by the caller.");
  }
  const settings = await loadSystemSettings();
  const adminBaseUrl = getGarageAdminBaseUrl(settings);
  const metricsUrl = `${adminBaseUrl}/metrics`;
  const metricsToken = settings.garageMetricsToken?.trim() || "";

  const response = await fetch(metricsUrl, {
    cache: "no-store",
    headers: metricsToken
      ? { Authorization: `Bearer ${metricsToken}` }
      : undefined,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Garage metrics (${response.status} ${response.statusText}).`,
    );
  }

  const metricsText = await response.text();
  const totalByVolume = parseMetricByVolume(
    metricsText,
    "garage_local_disk_total",
  );

  const roleCapacityBytes = parseConnectedRoleCapacity(metricsText);
  const fallbackDiskTotalBytes = pickPrimaryCapacity(totalByVolume);
  const totalBytes =
    roleCapacityBytes > 0 ? roleCapacityBytes : fallbackDiskTotalBytes;

  if (totalBytes <= 0) {
    throw new Error("Garage metrics did not contain a valid capacity value.");
  }

  const consumedBytes = await getBucketConsumedBytes(bucket, adminBaseUrl);
  const normalizedConsumed = Math.max(0, consumedBytes);
  const normalizedRemaining = Math.max(0, totalBytes - normalizedConsumed);

  return {
    totalBytes,
    remainingBytes: normalizedRemaining,
    consumedBytes: normalizedConsumed,
    metricsUrl,
    fetchedAt: new Date().toISOString(),
  };
}
