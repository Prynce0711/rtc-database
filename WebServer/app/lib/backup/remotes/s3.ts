import "server-only";
import type { BackupRemoteStorageUsage } from "../backupScheduler";

export type { BackupRemoteStorageUsage };

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

/**
 * Get S3 bucket storage usage with fallback from `rclone about` to `rclone size`.
 * S3 doesn't support the `about` command, so we fall back to `size` which returns
 * the total objects and total size in the bucket. Since S3 has no quota system,
 * we treat the bucket size as "usedBytes" and leave quota fields as null.
 */
export async function getS3StorageUsage(
  remoteName: string,
  bucket: string,
  runRcloneCommand: (
    args: string[],
    flags?: Record<string, string>,
    options?: Record<string, unknown>,
  ) => Promise<string>,
): Promise<BackupRemoteStorageUsage> {
  const target = `${remoteName}:${bucket}`;

  // First, try to get storage usage via `rclone about`
  try {
    const aboutOutput = await runRcloneCommand(
      ["about", target, "--json"],
      {},
      { silent: true, timeoutMs: 10_000 },
    );

    const parsed = JSON.parse(aboutOutput) as Record<string, unknown>;

    // If about succeeds, return the standard quota data
    return {
      remoteName,
      totalBytes: toNullableNumber(parsed.total),
      usedBytes: toNullableNumber(parsed.used),
      freeBytes: toNullableNumber(parsed.free),
      trashedBytes: toNullableNumber(parsed.trashed),
      otherBytes: toNullableNumber(parsed.other),
      objects: toNullableNumber(parsed.objects),
    };
  } catch {
    // S3 doesn't support `about`, so fall back to `rclone size`
  }

  // Fallback: use `rclone size` to get total bucket size
  try {
    const sizeOutput = await runRcloneCommand(
      ["size", target, "--json"],
      {},
      { silent: true, timeoutMs: 10_000 },
    );

    const parsed = JSON.parse(sizeOutput) as Record<string, unknown>;

    // rclone size returns: { count, bytes }
    // Since S3 has no quota system, we treat bucket size as "used" and leave quota fields null
    return {
      remoteName,
      totalBytes: null, // S3 has no quota system
      usedBytes: toNullableNumber(parsed.bytes),
      freeBytes: null, // Unlimited (pay-as-you-go)
      trashedBytes: null, // Not applicable to S3
      otherBytes: null, // Not applicable to S3
      objects: toNullableNumber(parsed.count),
    };
  } catch (error) {
    // If both about and size fail, throw the original error
    throw new Error(
      `Failed to retrieve S3 storage usage for ${remoteName}:${bucket}. ` +
        `Both 'about' and 'size' commands failed. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
