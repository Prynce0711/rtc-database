import "server-only";

// TODO: Make this server-only and users must first validate session and
// if they are authorized to use file management before calling these functions.
// This will prevent unauthorized users from even being able to call these functions and
// will simplify the code by not having to validate session in each function.
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ActionResult } from "@rtc-database/shared";
import { FileData } from "@rtc-database/shared/prisma/browser";
import { createHash } from "crypto";
import { GetFileOptions, getGarageClient } from "../lib/garage";
import { validateSession } from "./authActions";
import { prisma } from "./prisma";
import { loadSystemSettings } from "./systemSettings";

async function getGarageBucket(): Promise<string> {
  const settings = await loadSystemSettings();
  return settings.garageBucket?.trim() || "uploads";
}

export const GARAGE_ARCHIVES_ROOT = "archives";
export const GARAGE_NOTARIAL_ROOT = "notarial";

export async function getFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return createHash("sha256").update(Buffer.from(buffer)).digest("hex");
}

const normalizeGarageKey = (key: string): string => {
  const cleaned = String(key || "")
    .replace(/\\/g, "/")
    .trim()
    .replace(/^\/+/, "");
  const hasTrailingSlash = cleaned.endsWith("/");
  const normalized = cleaned
    .split("/")
    .map((segment) => segment.trim())
    .filter(
      (segment) => segment.length > 0 && segment !== "." && segment !== "..",
    )
    .join("/");

  return normalized && hasTrailingSlash ? `${normalized}/` : normalized;
};

const getGarageParentPath = (key: string): string => {
  const normalized = normalizeGarageKey(key).replace(/\/$/, "");
  if (!normalized.includes("/")) return "";
  return normalized.slice(0, normalized.lastIndexOf("/"));
};

const getGarageBaseName = (key: string): string => {
  const normalized = normalizeGarageKey(key).replace(/\/$/, "");
  if (!normalized) return "";
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? "";
};

const joinGaragePath = (parentPath: string, name: string): string => {
  const cleanedParent = normalizeGarageKey(parentPath).replace(/\/$/, "");
  const cleanedName = String(name || "")
    .replace(/\\/g, "/")
    .trim()
    .replace(/^\/+|\/+$/g, "");

  return cleanedParent ? `${cleanedParent}/${cleanedName}` : cleanedName;
};

const getGarageScopePrefix = (scopePrefix?: string): string =>
  normalizeGarageKey(scopePrefix || "").replace(/\/+$/, "");

const addGarageScopeToKey = (key: string, scopePrefix?: string): string => {
  const scope = getGarageScopePrefix(scopePrefix);
  const normalizedKey = normalizeGarageKey(key);
  if (!scope) return normalizedKey;
  if (!normalizedKey) return scope;

  const keyWithoutTrailingSlash = normalizedKey.replace(/\/+$/, "");
  const trailingSlash = normalizedKey.endsWith("/") ? "/" : "";

  if (
    keyWithoutTrailingSlash === scope ||
    keyWithoutTrailingSlash.startsWith(`${scope}/`)
  ) {
    return `${keyWithoutTrailingSlash}${trailingSlash}`;
  }

  return `${scope}/${normalizedKey}`;
};

const removeGarageScopeFromKey = (
  key: string,
  scopePrefix?: string,
): string => {
  const scope = getGarageScopePrefix(scopePrefix);
  const normalizedKey = normalizeGarageKey(key);
  if (!scope) return normalizedKey;

  const keyWithoutTrailingSlash = normalizedKey.replace(/\/+$/, "");
  const trailingSlash = normalizedKey.endsWith("/") ? "/" : "";

  if (keyWithoutTrailingSlash === scope) return "";
  if (keyWithoutTrailingSlash.startsWith(`${scope}/`)) {
    return `${keyWithoutTrailingSlash.slice(scope.length + 1)}${trailingSlash}`;
  }

  return normalizedKey;
};

const isGarageScopeRootKey = (key: string, scopePrefix?: string): boolean => {
  const scope = getGarageScopePrefix(scopePrefix);
  return !!scope && normalizeGarageKey(key).replace(/\/+$/, "") === scope;
};

const ensureGarageScopeFolderMarker = async (
  bucket: string,
  scopePrefix?: string,
): Promise<void> => {
  const scope = getGarageScopePrefix(scopePrefix);
  if (!scope) return;

  const markerKey = `${scope}/`;
  if (await garageObjectExists(bucket, markerKey)) return;

  const garageClient = await getGarageClient();
  await garageClient.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: markerKey,
      Body: new Uint8Array(0),
      ContentType: "application/x-directory",
    }),
  );
};

export async function uploadFileToGarage(
  file: File,
  fileName?: string,
  folderPath?: string,
  bucketParam?: string,
  scopePrefix?: string,
): Promise<ActionResult<FileData>>;
export async function uploadFileToGarage(
  file: File,
  key: string,
  folderPath?: string,
  bucketParam?: string,
  scopePrefix?: string,
): Promise<ActionResult<FileData>>;
export async function uploadFileToGarage(
  file: File,
  fileNameOrKey: string = "",
  folderPathParam: string = "",
  bucketParam?: string,
  scopePrefix?: string,
): Promise<ActionResult<FileData>> {
  return uploadFileToGarageCore(
    file,
    fileNameOrKey,
    folderPathParam,
    false,
    bucketParam,
    scopePrefix,
  );
}

// Use this only from trusted server-internal code paths that already validated user access.
export async function uploadFileToGarageTrusted(
  file: File,
  fileNameOrKey: string = "",
  folderPathParam: string = "",
  bucketParam?: string,
  scopePrefix?: string,
): Promise<ActionResult<FileData>> {
  return uploadFileToGarageCore(
    file,
    fileNameOrKey,
    folderPathParam,
    true,
    bucketParam,
    scopePrefix,
  );
}

async function uploadFileToGarageCore(
  file: File,
  fileNameOrKey: string,
  folderPathParam: string,
  skipSessionValidation: boolean,
  bucketParam?: string,
  scopePrefix?: string,
): Promise<ActionResult<FileData>> {
  try {
    if (!skipSessionValidation) {
      const sessionValidation = await validateSession();
      if (!sessionValidation.success) {
        return sessionValidation;
      }
    }

    const originalExt = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf("."))
      : "";

    let fileName = fileNameOrKey || `${Date.now()}-${file.name}`;
    let folderPath = folderPathParam;
    let key = folderPath ? `${folderPath}/${fileName}` : fileName;

    if (!folderPathParam && fileNameOrKey.includes("/")) {
      key = fileNameOrKey;
      const lastSlash = key.lastIndexOf("/");
      if (lastSlash === key.length - 1) {
        return {
          success: false,
          error: "Invalid key: key cannot end with '/'",
        };
      }
      fileName = key.slice(lastSlash + 1);
      folderPath = key.slice(0, lastSlash);
    }

    if (
      originalExt &&
      !fileName.toLowerCase().endsWith(originalExt.toLowerCase())
    ) {
      fileName = `${fileName}${originalExt}`;
      key = folderPath ? `${folderPath}/${fileName}` : fileName;
    }

    if (scopePrefix) {
      key = addGarageScopeToKey(key, scopePrefix);
      fileName = getGarageBaseName(key);
      folderPath = getGarageParentPath(key);
    }

    const configuredMaxSizeMb = Number.parseInt(
      process.env.MAX_FILE_SIZE || "",
      10,
    );
    const maxSizeMb = Number.isFinite(configuredMaxSizeMb)
      ? Math.max(configuredMaxSizeMb, 250)
      : 250;
    const maxSize = maxSizeMb * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        success: false,
        error: `File too large (max ${maxSizeMb}MB)`,
      };
    }

    const buffer = await file.arrayBuffer();
    const fileHash = createHash("sha256")
      .update(Buffer.from(buffer))
      .digest("hex");

    const existingFile = await prisma.fileData.findUnique({
      where: { key },
    });

    if (existingFile) {
      if (existingFile.fileHash === fileHash) {
        return {
          success: true,
          result: existingFile,
        };
      }

      return {
        success: false,
        error: `A different file already exists for key: ${key}`,
      };
    }

    const bucket = bucketParam || (await getGarageBucket());
    await ensureGarageScopeFolderMarker(bucket, scopePrefix);
    const garageClient = await getGarageClient();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: file.type,
    });

    await garageClient.send(command);

    const fileData = await prisma.fileData.create({
      data: {
        fileHash,
        fileName,
        path: folderPath,
        key: key,
        size: file.size,
        mimeType: file.type,
      },
    });

    return {
      success: true,
      result: fileData,
    };
  } catch (err) {
    console.error("Upload error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Upload failed",
    };
  }
}

export async function listGarageFiles(): Promise<
  ActionResult<
    Array<{
      key: string;
      size: number;
      lastModified: Date;
    }>
  >
> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const bucket = await getGarageBucket();
    const garageClient = await getGarageClient();

    const files: Array<{
      key: string;
      size: number;
      lastModified: Date;
    }> = [];
    let continuationToken: string | undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      });

      const response = await garageClient.send(command);

      // Filter out folder markers (keys ending with /)
      files.push(
        ...((response.Contents ?? [])
          .filter((item) => {
            const key = item.Key || "";
            return !key.endsWith("/");
          })
          .map((item) => ({
            key: item.Key || "",
            size: item.Size || 0,
            lastModified: item.LastModified || new Date(),
          })) || []),
      );

      continuationToken = response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return {
      success: true,
      result: files,
    };
  } catch (err) {
    console.error("List files error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to list files",
    };
  }
}

export async function getGarageFileUrl(
  key: string,
  options?: GetFileOptions,
  bucketParam?: string,
  scopePrefix?: string,
): Promise<ActionResult<string>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const scopedKey = scopePrefix ? addGarageScopeToKey(key, scopePrefix) : key;
    const inline = options?.inline ?? false;
    const normalizedFileName = (
      options?.fileName ||
      scopedKey.split("/").pop() ||
      "file"
    )
      .replace(/[\r\n"]/g, "")
      .trim();

    const bucket = bucketParam || (await getGarageBucket());
    const garageClient = await getGarageClient();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: scopedKey,
      ResponseContentDisposition: `${inline ? "inline" : "attachment"}; filename="${normalizedFileName}"`,
      ...(options?.contentType
        ? { ResponseContentType: options.contentType }
        : {}),
    });

    const signedUrl = await getSignedUrl(garageClient, command, {
      expiresIn: 3600,
    });

    return {
      success: true,
      result: `/api/user/garage?url=${encodeURIComponent(signedUrl)}`,
    };
  } catch (err) {
    console.error("Get file URL error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to get file URL",
    };
  }
}

export async function deleteGarageFile(
  key: string,
  bucketParam?: string,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const bucket = bucketParam || (await getGarageBucket());
    const garageClient = await getGarageClient();

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await garageClient.send(command);

    await prisma.fileData.deleteMany({
      where: {
        key: key,
      },
    });

    return {
      success: true,
      result: undefined,
    };
  } catch (err) {
    console.error("Delete file error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete file",
    };
  }
}

export type DeleteGarageKeysResult = {
  deletedCount: number;
  deletedKeys: string[];
};

export type MoveGarageKeysResult = {
  movedCount: number;
  movedKeys: Array<{
    oldKey: string;
    newKey: string;
  }>;
};

const encodeCopySourceKey = (key: string): string =>
  key.split("/").map(encodeURIComponent).join("/");

const listGarageObjectKeysByPrefix = async (
  bucket: string,
  prefix: string,
): Promise<string[]> => {
  const garageClient = await getGarageClient();
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await garageClient.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    keys.push(
      ...(response.Contents ?? [])
        .map((item) => item.Key || "")
        .filter((itemKey) => itemKey.length > 0),
    );

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return keys;
};

const deleteGarageObjectKeysRaw = async (
  bucket: string,
  keys: string[],
): Promise<ActionResult<void>> => {
  const garageClient = await getGarageClient();
  const keysToDelete = Array.from(new Set(keys.filter(Boolean)));

  for (let index = 0; index < keysToDelete.length; index += 1000) {
    const chunk = keysToDelete.slice(index, index + 1000);
    const deleteResult = await garageClient.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: chunk.map((key) => ({ Key: key })),
          Quiet: true,
        },
      }),
    );

    if (deleteResult.Errors && deleteResult.Errors.length > 0) {
      const firstError = deleteResult.Errors[0];
      return {
        success: false,
        error:
          firstError.Message ||
          `Failed to delete ${firstError.Key || "one or more Garage objects"}`,
      };
    }
  }

  return { success: true, result: undefined };
};

const garageObjectExists = async (
  bucket: string,
  key: string,
): Promise<boolean> => {
  const garageClient = await getGarageClient();
  const response = await garageClient.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: key,
      MaxKeys: 1,
    }),
  );

  return (response.Contents ?? []).some((item) => item.Key === key);
};

const moveGarageKeyPairs = async (
  bucket: string,
  pairs: Array<{ oldKey: string; newKey: string }>,
): Promise<ActionResult<MoveGarageKeysResult>> => {
  const normalizedPairs = pairs
    .map((pair) => ({
      oldKey: normalizeGarageKey(pair.oldKey),
      newKey: normalizeGarageKey(pair.newKey),
    }))
    .filter(
      (pair) => pair.oldKey && pair.newKey && pair.oldKey !== pair.newKey,
    );

  const uniquePairs = Array.from(
    new Map(normalizedPairs.map((pair) => [pair.oldKey, pair])).values(),
  );

  if (uniquePairs.length === 0) {
    return { success: false, error: "Nothing to move" };
  }

  const garageClient = await getGarageClient();
  for (const pair of uniquePairs) {
    if (await garageObjectExists(bucket, pair.newKey)) {
      return {
        success: false,
        error: `An item already exists at ${pair.newKey}`,
      };
    }
  }

  for (const pair of uniquePairs) {
    await garageClient.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${encodeCopySourceKey(pair.oldKey)}`,
        Key: pair.newKey,
        MetadataDirective: "COPY",
      }),
    );
  }

  await prisma.$transaction(
    uniquePairs.map((pair) =>
      prisma.fileData.updateMany({
        where: { key: pair.oldKey },
        data: {
          key: pair.newKey,
          fileName: getGarageBaseName(pair.newKey),
          path: getGarageParentPath(pair.newKey),
        },
      }),
    ),
  );

  const deleteResult = await deleteGarageObjectKeysRaw(
    bucket,
    uniquePairs.map((pair) => pair.oldKey),
  );
  if (!deleteResult.success) {
    return {
      success: false,
      error: deleteResult.error,
    };
  }

  return {
    success: true,
    result: {
      movedCount: uniquePairs.length,
      movedKeys: uniquePairs,
    },
  };
};

export async function moveGarageKeys(
  keys: string[],
  targetFolderPath: string,
  bucketParam?: string,
  scopePrefix?: string,
): Promise<ActionResult<MoveGarageKeysResult>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const requestedKeys = Array.from(
      new Set(
        keys
          .map((key) => addGarageScopeToKey(key, scopePrefix))
          .filter((key) => key.length > 0),
      ),
    );
    if (requestedKeys.length === 0) {
      return { success: false, error: "No files or folders selected" };
    }

    const bucket = bucketParam || (await getGarageBucket());
    await ensureGarageScopeFolderMarker(bucket, scopePrefix);
    if (
      scopePrefix &&
      requestedKeys.some((key) => isGarageScopeRootKey(key, scopePrefix))
    ) {
      return {
        success: false,
        error: "The root Garage folder cannot be moved.",
      };
    }

    const targetFolder = addGarageScopeToKey(
      targetFolderPath,
      scopePrefix,
    ).replace(/\/$/, "");
    const movePairs: Array<{ oldKey: string; newKey: string }> = [];

    for (const key of requestedKeys) {
      const isFolder = key.endsWith("/");
      if (isFolder) {
        const sourcePrefix = key;
        const sourceFolderPath = sourcePrefix.replace(/\/$/, "");
        if (
          targetFolder === sourceFolderPath ||
          targetFolder.startsWith(`${sourcePrefix}`)
        ) {
          return {
            success: false,
            error: "A folder cannot be moved into itself.",
          };
        }

        const destinationPrefix = `${joinGaragePath(
          targetFolder,
          getGarageBaseName(sourcePrefix),
        )}/`;
        const childKeys = await listGarageObjectKeysByPrefix(
          bucket,
          sourcePrefix,
        );

        for (const childKey of childKeys) {
          movePairs.push({
            oldKey: childKey,
            newKey: `${destinationPrefix}${childKey.slice(sourcePrefix.length)}`,
          });
        }
        continue;
      }

      movePairs.push({
        oldKey: key,
        newKey: joinGaragePath(targetFolder, getGarageBaseName(key)),
      });
    }

    const result = await moveGarageKeyPairs(bucket, movePairs);
    if (!result.success || !scopePrefix) {
      return result;
    }

    return {
      success: true,
      result: {
        movedCount: result.result.movedCount,
        movedKeys: result.result.movedKeys.map((pair) => ({
          oldKey: removeGarageScopeFromKey(pair.oldKey, scopePrefix),
          newKey: removeGarageScopeFromKey(pair.newKey, scopePrefix),
        })),
      },
    };
  } catch (err) {
    console.error("Move Garage keys error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to move Garage items",
    };
  }
}

export async function renameGarageKey(
  key: string,
  newName: string,
  bucketParam?: string,
  scopePrefix?: string,
): Promise<ActionResult<MoveGarageKeysResult>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const normalizedKey = addGarageScopeToKey(key, scopePrefix);
    const normalizedName = String(newName || "").trim();
    if (!normalizedKey) {
      return { success: false, error: "No file or folder selected" };
    }
    if (scopePrefix && isGarageScopeRootKey(normalizedKey, scopePrefix)) {
      return {
        success: false,
        error: "The root Garage folder cannot be renamed.",
      };
    }
    if (
      !normalizedName ||
      normalizedName.includes("/") ||
      normalizedName.includes("\\")
    ) {
      return { success: false, error: "Enter a valid name without slashes" };
    }

    const bucket = bucketParam || (await getGarageBucket());
    await ensureGarageScopeFolderMarker(bucket, scopePrefix);
    const parentPath = getGarageParentPath(normalizedKey);
    const finish = (
      result: ActionResult<MoveGarageKeysResult>,
    ): ActionResult<MoveGarageKeysResult> => {
      if (!result.success || !scopePrefix) return result;

      return {
        success: true,
        result: {
          movedCount: result.result.movedCount,
          movedKeys: result.result.movedKeys.map((pair) => ({
            oldKey: removeGarageScopeFromKey(pair.oldKey, scopePrefix),
            newKey: removeGarageScopeFromKey(pair.newKey, scopePrefix),
          })),
        },
      };
    };

    if (normalizedKey.endsWith("/")) {
      const sourcePrefix = normalizedKey;
      const destinationPrefix = `${joinGaragePath(parentPath, normalizedName)}/`;
      const childKeys = await listGarageObjectKeysByPrefix(
        bucket,
        sourcePrefix,
      );
      const movePairs = childKeys.map((childKey) => ({
        oldKey: childKey,
        newKey: `${destinationPrefix}${childKey.slice(sourcePrefix.length)}`,
      }));

      return finish(await moveGarageKeyPairs(bucket, movePairs));
    }

    return finish(
      await moveGarageKeyPairs(bucket, [
        {
          oldKey: normalizedKey,
          newKey: joinGaragePath(parentPath, normalizedName),
        },
      ]),
    );
  } catch (err) {
    console.error("Rename Garage key error:", err);
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to rename Garage item",
    };
  }
}

export async function deleteGarageKeys(
  keys: string[],
  bucketParam?: string,
  scopePrefix?: string,
): Promise<ActionResult<DeleteGarageKeysResult>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const requestedKeys = Array.from(
      new Set(
        keys
          .map((key) => addGarageScopeToKey(key, scopePrefix))
          .filter((key) => key.length > 0),
      ),
    );

    if (requestedKeys.length === 0) {
      return { success: false, error: "No files or folders selected" };
    }
    if (
      scopePrefix &&
      requestedKeys.some((key) => isGarageScopeRootKey(key, scopePrefix))
    ) {
      return {
        success: false,
        error: "The root Garage folder cannot be deleted.",
      };
    }

    const bucket = bucketParam || (await getGarageBucket());
    await ensureGarageScopeFolderMarker(bucket, scopePrefix);
    const garageClient = await getGarageClient();
    const keysToDelete = new Set<string>();

    for (const key of requestedKeys) {
      keysToDelete.add(key);

      if (key.endsWith("/")) {
        const folderKeys = await listGarageObjectKeysByPrefix(bucket, key);
        for (const folderKey of folderKeys) {
          keysToDelete.add(folderKey);
        }
      }
    }

    const deletedKeys = Array.from(keysToDelete);
    if (deletedKeys.length === 0) {
      return { success: false, error: "No matching Garage objects found" };
    }

    for (let index = 0; index < deletedKeys.length; index += 1000) {
      const chunk = deletedKeys.slice(index, index + 1000);
      const deleteResult = await garageClient.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: chunk.map((key) => ({ Key: key })),
            Quiet: true,
          },
        }),
      );

      if (deleteResult.Errors && deleteResult.Errors.length > 0) {
        const firstError = deleteResult.Errors[0];
        return {
          success: false,
          error:
            firstError.Message ||
            `Failed to delete ${firstError.Key || "one or more Garage objects"}`,
        };
      }
    }

    const linkedFiles = await prisma.fileData.findMany({
      where: {
        key: {
          in: deletedKeys,
        },
      },
      select: {
        id: true,
      },
    });
    const linkedFileIds = linkedFiles.map((file) => file.id);

    if (linkedFileIds.length > 0) {
      await prisma.$transaction([
        prisma.archiveEntry.updateMany({
          where: {
            fileId: {
              in: linkedFileIds,
            },
          },
          data: {
            fileId: null,
          },
        }),
        prisma.notarial.updateMany({
          where: {
            fileId: {
              in: linkedFileIds,
            },
          },
          data: {
            fileId: null,
          },
        }),
        prisma.chatMessage.updateMany({
          where: {
            fileId: {
              in: linkedFileIds,
            },
          },
          data: {
            fileId: null,
          },
        }),
        prisma.fileData.deleteMany({
          where: {
            id: {
              in: linkedFileIds,
            },
          },
        }),
      ]);
    }

    return {
      success: true,
      result: {
        deletedCount: deletedKeys.length,
        deletedKeys: scopePrefix
          ? deletedKeys.map((key) => removeGarageScopeFromKey(key, scopePrefix))
          : deletedKeys,
      },
    };
  } catch (err) {
    console.error("Delete Garage keys error:", err);
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to delete Garage items",
    };
  }
}

export async function moveGarageFile(
  oldKey: string,
  newFolderPath: string,
  newFileName: string,
  bucketParam?: string,
): Promise<ActionResult<void>>;
export async function moveGarageFile(
  oldKey: string,
  newKey: string,
  newFileNameParam?: string,
  bucketParam?: string,
): Promise<ActionResult<void>>;
export async function moveGarageFile(
  oldKey: string,
  newFolderOrKey: string,
  newFileNameParam: string = "",
  bucketParam?: string,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    let newFolderPath = newFolderOrKey;
    let newFileName = newFileNameParam;
    let newKey = newFolderPath
      ? `${newFolderPath}/${newFileName}`
      : newFileName;

    if (!newFileNameParam && newFolderOrKey.includes("/")) {
      newKey = newFolderOrKey;
      const lastSlash = newKey.lastIndexOf("/");
      if (lastSlash === newKey.length - 1) {
        return {
          success: false,
          error: "Invalid key: key cannot end with '/'",
        };
      }
      newFileName = newKey.slice(lastSlash + 1);
      newFolderPath = newKey.slice(0, lastSlash);
    }

    const bucket = bucketParam || (await getGarageBucket());
    const garageClient = await getGarageClient();

    await garageClient.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${oldKey}`,
        Key: newKey,
        MetadataDirective: "COPY",
      }),
    );

    const updateResult = await prisma.fileData.update({
      where: {
        key: oldKey,
      },
      data: {
        key: newKey,
        fileName: newFileName,
        path: newFolderPath,
      },
    });

    if (!updateResult) {
      return {
        success: false,
        error: "File moved but database record was not found.",
      };
    }

    await garageClient.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: oldKey,
      }),
    );

    return {
      success: true,
      result: undefined,
    };
  } catch (err) {
    console.error("Move file error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to move file",
    };
  }
}

export async function createGarageFolder(
  name: string,
  parentPath: string = "",
  bucketParam?: string,
  scopePrefix?: string,
): Promise<
  ActionResult<{
    id: number;
    name: string;
    parentPath: string;
    fullPath: string;
  }>
> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const folderName = String(name || "").trim();
    if (!folderName) {
      return { success: false, error: "Folder name is required" };
    }

    const cleanedParent = String(parentPath || "")
      .trim()
      .replace(/^\/+|\/+$/g, "");
    const fullPath = cleanedParent
      ? `${cleanedParent}/${folderName}`
      : folderName;
    const storageFullPath = scopePrefix
      ? addGarageScopeToKey(fullPath, scopePrefix)
      : fullPath;

    // check for existing archive entry with same fullPath
    const existing = await prisma.archiveEntry.findUnique({
      where: { fullPath },
    });
    if (existing) {
      return {
        success: false,
        error: "A file or folder already exists at that path",
      };
    }

    const bucket = bucketParam || (await getGarageBucket());
    await ensureGarageScopeFolderMarker(bucket, scopePrefix);
    const garageClient = await getGarageClient();

    // Create a zero-byte object with trailing slash to represent folder
    await garageClient.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${storageFullPath}/`,
        Body: new Uint8Array(0),
        ContentType: "application/x-directory",
      }),
    );

    const created = await prisma.archiveEntry.create({
      data: {
        name: folderName,
        parentPath: cleanedParent,
        fullPath,
        entryType: "FOLDER",
      },
    });

    return {
      success: true,
      result: {
        id: created.id,
        name: created.name,
        parentPath: created.parentPath,
        fullPath: created.fullPath,
      },
    };
  } catch (err) {
    console.error("Create folder error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create folder",
    };
  }
}

export async function createGarageFolderMarker(
  folderPath: string,
  bucketParam?: string,
  scopePrefix?: string,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const cleanedPath = String(folderPath || "")
      .trim()
      .replace(/^\/+|\/+$/g, "");
    const storagePath = scopePrefix
      ? addGarageScopeToKey(cleanedPath, scopePrefix)
      : cleanedPath;
    if (!storagePath) {
      return { success: false, error: "Folder path is required" };
    }

    const bucket = bucketParam || (await getGarageBucket());
    await ensureGarageScopeFolderMarker(bucket, scopePrefix);
    const garageClient = await getGarageClient();

    await garageClient.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${storagePath}/`,
        Body: new Uint8Array(0),
        ContentType: "application/x-directory",
      }),
    );

    return {
      success: true,
      result: undefined,
    };
  } catch (err) {
    console.error("Create folder marker error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create folder",
    };
  }
}

export type GarageItem = {
  key: string;
  name: string;
  size: number;
  lastModified: Date | null;
  isDirectory: boolean;
};

/**
 * List contents of a folder (non-recursive). Returns both immediate subfolders
 * (as isDirectory=true) and files. If `bucketParam` is provided it will be used
 * instead of the configured garage bucket. `folderPath` may be empty to list
 * the root of the bucket.
 */
export async function listGarageFolder(
  folderPath: string = "",
  bucketParam?: string,
  scopePrefix?: string,
): Promise<ActionResult<GarageItem[]>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const bucket = bucketParam || (await getGarageBucket());
    await ensureGarageScopeFolderMarker(bucket, scopePrefix);
    const garageClient = await getGarageClient();

    const cleaned = String(folderPath || "")
      .trim()
      .replace(/^\/+|\/+$/g, "");
    const storageFolder = scopePrefix
      ? addGarageScopeToKey(cleaned, scopePrefix)
      : cleaned;
    const prefix = storageFolder ? `${storageFolder}/` : "";

    const dirsByKey = new Map<string, GarageItem>();
    const filesByKey = new Map<string, GarageItem>();
    let continuationToken: string | undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        Delimiter: "/",
        ContinuationToken: continuationToken,
      });

      const response = await garageClient.send(command);

      for (const cp of response.CommonPrefixes ?? []) {
        const key = cp.Prefix || "";
        if (!key || dirsByKey.has(key)) continue;

        const name = key.slice(prefix.length).replace(/\/$/, "");
        dirsByKey.set(key, {
          key: removeGarageScopeFromKey(key, scopePrefix),
          name,
          size: 0,
          lastModified: null,
          isDirectory: true,
        });
      }

      for (const item of response.Contents ?? []) {
        const key = item.Key || "";
        if (
          !key ||
          key === prefix ||
          key.endsWith("/") ||
          filesByKey.has(key)
        ) {
          continue;
        }

        filesByKey.set(key, {
          key: removeGarageScopeFromKey(key, scopePrefix),
          name: key.slice(prefix.length),
          size: item.Size || 0,
          lastModified: item.LastModified || null,
          isDirectory: false,
        });
      }

      continuationToken = response.IsTruncated
        ? response.NextContinuationToken
        : undefined;
    } while (continuationToken);

    const dirs = Array.from(dirsByKey.values());
    const files = Array.from(filesByKey.values());

    const items = [
      ...dirs.sort((a, b) => a.name.localeCompare(b.name)),
      ...files.sort((a, b) => a.name.localeCompare(b.name)),
    ];

    return { success: true, result: items };
  } catch (err) {
    console.error("List folder error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to list folder",
    };
  }
}
