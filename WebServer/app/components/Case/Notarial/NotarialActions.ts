"use server";

import { validateSession } from "@/app/lib/authActions";
import { GetFileOptions, getGarageClient } from "@/app/lib/garage";
import {
  createGarageFolderMarker,
  deleteGarageFile,
  deleteGarageKeys,
  GARAGE_NOTARIAL_ROOT,
  getFileHash,
  getGarageFileUrl,
  listGarageFolder,
  moveGarageFile,
  moveGarageKeys,
  renameGarageKey,
  uploadFileToGarage,
  uploadFileToGarageTrusted,
  type GarageItem,
} from "@/app/lib/garageActions";
import { prisma } from "@/app/lib/prisma";
import { redisConnection } from "@/app/lib/redis";
import Roles from "@/app/lib/Roles";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import {
  ActionResult,
  FilterOptions,
  PaginatedResult,
} from "@rtc-database/shared";
import { Prisma } from "@rtc-database/shared/prisma/client";
import { createHash, randomUUID } from "crypto";
import { prettifyError } from "zod";
import { generateFileKey, NotarialData, NotarialSchema } from "./schema";

type NotarialListFilterShape = {
  query?: string | null;
  title?: string | null;
  name?: string | null;
  atty?: string | null;
  fileType?: string | null;
  date?: { start?: string; end?: string };
};

export type NotarialFilterOptions = FilterOptions<NotarialListFilterShape> & {
  sortKey?: "title" | "name" | "atty" | "date";
};

export type NotarialStats = {
  totalRecords: number;
  thisMonth: number;
  uniqueAttorneys: number;
  noDate: number;
  storedFiles: number;
  storageUsedBytes: number;
};

export type NotarialRecentFile = {
  id: number;
  fileName: string;
  title: string | null;
  name: string | null;
  attorney: string | null;
  mimeType: string | null;
  uploadedAt: Date;
};

const NOTARIAL_ACCESS_ROLES = [Roles.ADMIN, Roles.NOTARIAL] as const;
const NOTARIAL_GARAGE_BUCKET = "rtc-bucket";
const NOTARIAL_GARAGE_ROOT = GARAGE_NOTARIAL_ROOT;

const OFFICE_EDITABLE_EXTENSIONS = new Set(["doc", "docx", "xls", "xlsx"]);
const OFFICE_EDITABLE_MIME_TOKENS = [
  "word",
  "wordprocessingml",
  "excel",
  "spreadsheet",
  "officedocument",
];

const NOTARIAL_EDIT_LOCK_TTL_SECONDS = 45;
const NOTARIAL_EDIT_HEARTBEAT_INTERVAL_MS = 10_000;
const NOTARIAL_EDIT_SYNC_INTERVAL_MS = 15_000;
const NOTARIAL_EDIT_STALE_GRACE_MS = Math.max(
  5000,
  Math.min(
    NOTARIAL_EDIT_LOCK_TTL_SECONDS * 1000 - 5000,
    NOTARIAL_EDIT_HEARTBEAT_INTERVAL_MS * 3,
  ),
);

export type NotarialEditLockOptions = {
  deviceId?: string;
};

export type NotarialEditLockErrorResult = {
  code: "locked";
  lockId: string;
  lockedBy: string;
  lockDeviceId?: string | null;
};

type NotarialEditLockPayload = {
  lockId: string;
  recordId: number;
  userId: string;
  userDisplayName: string;
  deviceId?: string | null;
  acquiredAt: string;
  heartbeatAt: string;
};

type NotarialGarageEditLockPayload = {
  lockId: string;
  garageKey: string;
  userId: string;
  userDisplayName: string;
  deviceId?: string | null;
  acquiredAt: string;
  heartbeatAt: string;
};

const normalizeGaragePath = (path?: string | null): string =>
  (path ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(
      (segment) => segment.length > 0 && segment !== "." && segment !== "..",
    )
    .join("/");

const buildFolderUploadKey = (folderPath: string, file: File): string => {
  const fileName = file.name.trim() || `upload-${Date.now()}`;
  return folderPath ? `${folderPath}/${fileName}` : fileName;
};

const scopeNotarialStorageKey = (key: string): string => {
  const normalized = normalizeGaragePath(key);
  if (!normalized) return NOTARIAL_GARAGE_ROOT;
  return normalized === NOTARIAL_GARAGE_ROOT ||
    normalized.startsWith(`${NOTARIAL_GARAGE_ROOT}/`)
    ? normalized
    : `${NOTARIAL_GARAGE_ROOT}/${normalized}`;
};

const getNotarialEditLockKey = (recordId: number): string =>
  `notarial:edit-lock:record:${recordId}`;

const getNotarialEditTokenKey = (lockId: string): string =>
  `notarial:edit-lock:token:${lockId}`;

const normalizeNotarialGarageKey = (garageKey: string): string =>
  String(garageKey || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");

const getNotarialGarageLockScopeKey = (garageKey: string): string => {
  const normalized = normalizeNotarialGarageKey(garageKey);
  return createHash("sha256").update(normalized).digest("hex");
};

const getNotarialGarageEditLockKey = (garageKey: string): string =>
  `notarial:edit-lock:garage:${getNotarialGarageLockScopeKey(garageKey)}`;

const parseNotarialEditLockPayload = (
  raw: string | null,
): NotarialEditLockPayload | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<NotarialEditLockPayload>;
    if (
      typeof parsed.lockId !== "string" ||
      typeof parsed.recordId !== "number" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.userDisplayName !== "string" ||
      typeof parsed.acquiredAt !== "string" ||
      typeof parsed.heartbeatAt !== "string"
    ) {
      return null;
    }

    const deviceId =
      typeof parsed.deviceId === "string" ? parsed.deviceId : null;

    return {
      lockId: parsed.lockId,
      recordId: parsed.recordId,
      userId: parsed.userId,
      userDisplayName: parsed.userDisplayName,
      deviceId,
      acquiredAt: parsed.acquiredAt,
      heartbeatAt: parsed.heartbeatAt,
    };
  } catch {
    return null;
  }
};

const parseNotarialGarageEditLockPayload = (
  raw: string | null,
): NotarialGarageEditLockPayload | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<NotarialGarageEditLockPayload>;
    if (
      typeof parsed.lockId !== "string" ||
      typeof parsed.garageKey !== "string" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.userDisplayName !== "string" ||
      typeof parsed.acquiredAt !== "string" ||
      typeof parsed.heartbeatAt !== "string"
    ) {
      return null;
    }

    const deviceId =
      typeof parsed.deviceId === "string" ? parsed.deviceId : null;

    return {
      lockId: parsed.lockId,
      garageKey: parsed.garageKey,
      userId: parsed.userId,
      userDisplayName: parsed.userDisplayName,
      deviceId,
      acquiredAt: parsed.acquiredAt,
      heartbeatAt: parsed.heartbeatAt,
    };
  } catch {
    return null;
  }
};

const normalizeDeviceId = (value?: string | null): string | null => {
  const normalized = String(value || "").trim();
  return normalized.length > 0 ? normalized : null;
};

const isLockStale = (heartbeatAt: string): boolean => {
  const heartbeatMs = Date.parse(heartbeatAt);
  if (!Number.isFinite(heartbeatMs)) {
    return true;
  }

  return Date.now() - heartbeatMs > NOTARIAL_EDIT_STALE_GRACE_MS;
};

const clearNotarialEditLock = async (lockKey: string, lockId: string) => {
  await redisConnection.del(lockKey);
  await redisConnection.del(getNotarialEditTokenKey(lockId));
};

const isOfficeEditableNotarialFile = (record: {
  title?: string | null;
  file?: { fileName: string | null; mimeType: string | null } | null;
}): boolean => {
  const fileName = record.file?.fileName || record.title || "";
  const extension = fileName.includes(".")
    ? fileName
        .slice(fileName.lastIndexOf(".") + 1)
        .toLowerCase()
        .trim()
    : "";

  if (OFFICE_EDITABLE_EXTENSIONS.has(extension)) {
    return true;
  }

  const mimeType = (record.file?.mimeType || "").toLowerCase();
  return OFFICE_EDITABLE_MIME_TOKENS.some((token) => mimeType.includes(token));
};

const refreshNotarialEditLock = async (
  lockId: string,
  nextPayload: NotarialEditLockPayload,
): Promise<boolean> => {
  const tokenKey = getNotarialEditTokenKey(lockId);
  const lockKey = getNotarialEditLockKey(nextPayload.recordId);
  const payloadJson = JSON.stringify(nextPayload);

  const updated = await redisConnection.eval(
    `
      local tokenKey = KEYS[1]
      local lockKey = KEYS[2]
      local expectedRecordId = ARGV[1]
      local expectedLockId = ARGV[2]
      local payload = ARGV[3]
      local ttl = tonumber(ARGV[4])

      local recordId = redis.call('GET', tokenKey)
      if not recordId or recordId ~= expectedRecordId then
        return 0
      end

      local lockPayload = redis.call('GET', lockKey)
      if not lockPayload then
        return 0
      end

      local ok, decoded = pcall(cjson.decode, lockPayload)
      if not ok or not decoded or decoded['lockId'] ~= expectedLockId then
        return 0
      end

      redis.call('SET', lockKey, payload, 'EX', ttl)
      redis.call('SET', tokenKey, expectedRecordId, 'EX', ttl)
      return 1
    `,
    2,
    tokenKey,
    lockKey,
    String(nextPayload.recordId),
    lockId,
    payloadJson,
    String(NOTARIAL_EDIT_LOCK_TTL_SECONDS),
  );

  return updated === 1;
};

const refreshNotarialGarageEditLock = async (
  lockId: string,
  nextPayload: NotarialGarageEditLockPayload,
): Promise<boolean> => {
  const tokenKey = getNotarialEditTokenKey(lockId);
  const lockScope = getNotarialGarageLockScopeKey(nextPayload.garageKey);
  const lockKey = getNotarialGarageEditLockKey(nextPayload.garageKey);
  const payloadJson = JSON.stringify(nextPayload);

  const updated = await redisConnection.eval(
    `
      local tokenKey = KEYS[1]
      local lockKey = KEYS[2]
      local expectedLockScope = ARGV[1]
      local expectedLockId = ARGV[2]
      local payload = ARGV[3]
      local ttl = tonumber(ARGV[4])

      local lockScope = redis.call('GET', tokenKey)
      if not lockScope or lockScope ~= expectedLockScope then
        return 0
      end

      local lockPayload = redis.call('GET', lockKey)
      if not lockPayload then
        return 0
      end

      local ok, decoded = pcall(cjson.decode, lockPayload)
      if not ok or not decoded or decoded['lockId'] ~= expectedLockId then
        return 0
      end

      redis.call('SET', lockKey, payload, 'EX', ttl)
      redis.call('SET', tokenKey, expectedLockScope, 'EX', ttl)
      return 1
    `,
    2,
    tokenKey,
    lockKey,
    lockScope,
    lockId,
    payloadJson,
    String(NOTARIAL_EDIT_LOCK_TTL_SECONDS),
  );

  return updated === 1;
};

function buildNotarialWhere(
  options?: NotarialFilterOptions,
): Prisma.NotarialWhereInput {
  const filters = options?.filters;
  const exactMatchMap = options?.exactMatchMap ?? {};
  const conditions: Prisma.NotarialWhereInput[] = [];

  const normalizedQuery = filters?.query?.trim();

  if (normalizedQuery) {
    conditions.push({
      OR: [
        {
          title: {
            contains: normalizedQuery,
          },
        },
        {
          name: {
            contains: normalizedQuery,
          },
        },
        {
          attorney: {
            contains: normalizedQuery,
          },
        },
        {
          file: {
            is: {
              fileName: {
                contains: normalizedQuery,
              },
            },
          },
        },
        {
          file: {
            is: {
              path: {
                contains: normalizedQuery,
              },
            },
          },
        },
      ],
    });
  }

  const addStringFilter = (
    key: "title" | "name" | "attorney",
    value?: string | null,
    exactKey?: "title" | "name" | "atty",
  ) => {
    if (!value) return;
    const exactMatch = exactMatchMap[exactKey ?? key] ?? false;
    conditions.push({
      [key]: {
        [exactMatch ? "equals" : "contains"]: value,
      },
    });
  };

  addStringFilter("title", filters?.title, "title");
  addStringFilter("name", filters?.name, "name");
  addStringFilter("attorney", filters?.atty, "atty");

  if (filters?.date?.start || filters?.date?.end) {
    conditions.push({
      date: {
        gte: filters.date.start ? new Date(filters.date.start) : undefined,
        lte: filters.date.end ? new Date(filters.date.end) : undefined,
      },
    });
  }

  if (filters?.fileType) {
    const normalizedType = filters.fileType.trim().toLowerCase();
    let fileTypeWhere: Prisma.FileDataWhereInput | null = null;

    if (normalizedType === "pdf") {
      fileTypeWhere = {
        OR: [
          {
            mimeType: {
              equals: "application/pdf",
            },
          },
          {
            fileName: {
              endsWith: ".pdf",
            },
          },
        ],
      };
    } else if (normalizedType === "word") {
      fileTypeWhere = {
        OR: [
          {
            mimeType: {
              contains: "word",
            },
          },
          {
            mimeType: {
              contains: "officedocument.wordprocessingml",
            },
          },
          {
            fileName: {
              endsWith: ".doc",
            },
          },
          {
            fileName: {
              endsWith: ".docx",
            },
          },
        ],
      };
    } else if (normalizedType === "excel") {
      fileTypeWhere = {
        OR: [
          {
            mimeType: {
              contains: "excel",
            },
          },
          {
            mimeType: {
              contains: "spreadsheetml",
            },
          },
          {
            fileName: {
              endsWith: ".xls",
            },
          },
          {
            fileName: {
              endsWith: ".xlsx",
            },
          },
        ],
      };
    } else if (normalizedType === "image") {
      fileTypeWhere = {
        mimeType: {
          startsWith: "image/",
        },
      };
    } else if (normalizedType === "other") {
      fileTypeWhere = {
        AND: [
          {
            NOT: {
              mimeType: {
                equals: "application/pdf",
              },
            },
          },
          {
            NOT: {
              mimeType: {
                startsWith: "image/",
              },
            },
          },
          {
            NOT: {
              mimeType: {
                contains: "word",
              },
            },
          },
          {
            NOT: {
              mimeType: {
                contains: "spreadsheet",
              },
            },
          },
        ],
      };
    }

    if (fileTypeWhere) {
      conditions.push({
        file: {
          is: fileTypeWhere,
        },
      });
    }
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

async function deleteFileIfUnreferenced(fileId: number, key: string) {
  const remainingReferences = await prisma.notarial.count({
    where: { fileId },
  });

  if (remainingReferences === 0) {
    await deleteGarageFile(key, NOTARIAL_GARAGE_BUCKET);
  }
}

export async function getNotarial(): Promise<ActionResult<NotarialData[]>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const notarial = await prisma.notarial.findMany({
      include: {
        file: true,
      },
    });

    return { success: true, result: notarial };
  } catch (error) {
    console.error("Error fetching notarial data:", error);
    return { success: false, error: "Error fetching notarial data" };
  }
}

export async function getNotarialById(
  id: number,
): Promise<ActionResult<NotarialData>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const notarial = await prisma.notarial.findUnique({
      where: { id },
      include: { file: true },
    });

    if (!notarial) {
      return { success: false, error: "Notarial data not found" };
    }

    return { success: true, result: notarial };
  } catch (error) {
    console.error("Error fetching notarial data by id:", error);
    return { success: false, error: "Error fetching notarial data" };
  }
}

export async function getNotarialByIds(
  ids: Array<number | string>,
): Promise<ActionResult<NotarialData[]>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const validIds = ids
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (validIds.length === 0) {
      return { success: false, error: "No valid ids provided" };
    }

    const items = await prisma.notarial.findMany({
      where: { id: { in: validIds } },
      include: { file: true },
    });

    const orderMap = new Map(validIds.map((id, index) => [id, index]));
    const sortedItems = items.sort(
      (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
    );

    if (sortedItems.length !== validIds.length) {
      return { success: false, error: "One or more records were not found" };
    }

    return { success: true, result: sortedItems };
  } catch (error) {
    console.error("Error fetching notarial data by ids:", error);
    return { success: false, error: "Error fetching notarial data" };
  }
}

export async function getNotarialPage(
  options?: NotarialFilterOptions,
): Promise<ActionResult<PaginatedResult<NotarialData>>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const page = options?.page && options.page > 0 ? options.page : 1;
    const pageSize =
      options?.pageSize && options.pageSize > 0 ? options.pageSize : 25;

    const where = buildNotarialWhere(options);
    const sortKey = options?.sortKey === "atty" ? "attorney" : options?.sortKey;
    const orderBy: Prisma.NotarialOrderByWithRelationInput = {
      [sortKey ?? "date"]: options?.sortOrder ?? "desc",
    };

    const [items, total] = await prisma.$transaction([
      prisma.notarial.findMany({
        where,
        orderBy,
        include: { file: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notarial.count({ where }),
    ]);

    return {
      success: true,
      result: {
        items,
        total,
      },
    };
  } catch (error) {
    console.error("Error fetching paginated notarial data:", error);
    return { success: false, error: "Error fetching paginated notarial data" };
  }
}

export async function getNotarialStats(
  options?: NotarialFilterOptions,
): Promise<ActionResult<NotarialStats>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const where = buildNotarialWhere(options);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [totalRecords, thisMonth, noDate, attorneys, fileStats] =
      await prisma.$transaction([
        prisma.notarial.count({ where }),
        prisma.notarial.count({
          where: {
            AND: [
              where,
              {
                date: {
                  gte: monthStart,
                  lt: nextMonthStart,
                },
              },
            ],
          },
        }),
        prisma.notarial.count({
          where: {
            AND: [where, { date: null }],
          },
        }),
        prisma.notarial.findMany({
          where,
          select: { attorney: true },
          distinct: ["attorney"],
        }),
        prisma.notarial.findMany({
          where: {
            AND: [where, { fileId: { not: null } }],
          },
          select: {
            file: {
              select: {
                size: true,
              },
            },
          },
        }),
      ]);

    const storageUsedBytes = fileStats.reduce(
      (total, item) => total + (item.file?.size ?? 0),
      0,
    );

    return {
      success: true,
      result: {
        totalRecords,
        thisMonth,
        uniqueAttorneys: attorneys.filter((a) => !!a.attorney).length,
        noDate,
        storedFiles: fileStats.length,
        storageUsedBytes,
      },
    };
  } catch (error) {
    console.error("Error fetching notarial stats:", error);
    return { success: false, error: "Error fetching notarial stats" };
  }
}

export async function createNotarial(
  data: Record<string, unknown>,
): Promise<ActionResult<NotarialData>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const parsedData = NotarialSchema.safeParse(data);
    if (!parsedData.success) {
      return {
        success: false,
        error: "Invalid notarial data: " + prettifyError(parsedData.error),
      };
    }

    const { file, path, removeFile, ...notarialFields } = parsedData.data;
    void removeFile;

    if (!file) {
      throw new Error("File is required for creating notarial data");
    }

    let uploadResult;
    try {
      const fileHash = await getFileHash(file);
      const targetFolder = normalizeGaragePath(path);
      const uploadKey =
        path != null
          ? buildFolderUploadKey(targetFolder, file)
          : generateFileKey({ ...parsedData.data, fileHash });
      uploadResult = await uploadFileToGarage(
        file,
        uploadKey,
        "",
        NOTARIAL_GARAGE_BUCKET,
        NOTARIAL_GARAGE_ROOT,
      );
    } catch (uploadError) {
      console.error("Error uploading file to garage:", uploadError);
      return {
        success: false,
        error:
          "Notarial file upload failed: " +
          (uploadError instanceof Error
            ? uploadError.message
            : "Unknown error"),
      };
    }

    if (!uploadResult.success) {
      return {
        success: false,
        error: "Notarial file upload failed: " + uploadResult.error,
      };
    }

    const createdNotarial = await prisma.notarial.create({
      data: {
        ...notarialFields,
        fileId: uploadResult.result.id,
      },
    });

    const notarialWithFile = await prisma.notarial.findUnique({
      where: { id: createdNotarial.id },
      include: { file: true },
    });

    if (!notarialWithFile) {
      return {
        success: false,
        error: "Notarial created but failed to retrieve with file data",
      };
    }

    return { success: true, result: notarialWithFile };
  } catch (error) {
    console.error("Error creating notarial data:", error);
    return { success: false, error: "Error creating notarial data" };
  }
}

export async function updateNotarial(
  id: number,
  data: Record<string, unknown>,
): Promise<ActionResult<NotarialData>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const existingNotarial = await prisma.notarial.findUnique({
      where: { id },
      include: { file: true },
    });

    if (!existingNotarial) {
      return { success: false, error: "Notarial data not found" };
    }

    const parsedData = NotarialSchema.safeParse(data);
    if (!parsedData.success) {
      return {
        success: false,
        error: "Invalid notarial data: " + prettifyError(parsedData.error),
      };
    }

    const mergedData = {
      title:
        parsedData.data.title !== undefined
          ? parsedData.data.title
          : existingNotarial.title,
      name:
        parsedData.data.name !== undefined
          ? parsedData.data.name
          : existingNotarial.name,
      attorney:
        parsedData.data.attorney !== undefined
          ? parsedData.data.attorney
          : existingNotarial.attorney,
      date:
        parsedData.data.date !== undefined
          ? parsedData.data.date
          : existingNotarial.date,
    };

    const incomingFile = parsedData.data.file;
    const removeFile = parsedData.data.removeFile === true;
    const shouldRemoveFile = removeFile || incomingFile === null;
    const removingOnly = shouldRemoveFile && !incomingFile;

    await prisma.notarial.update({
      where: { id },
      data: {
        ...mergedData,
        fileId: removingOnly ? null : undefined,
      },
    });

    if (removingOnly) {
      if (existingNotarial.file) {
        await deleteFileIfUnreferenced(
          existingNotarial.file.id,
          existingNotarial.file.key,
        );
      }
    } else if (incomingFile) {
      if (existingNotarial.file) {
        await prisma.notarial.update({
          where: { id },
          data: { fileId: null },
        });
        await deleteFileIfUnreferenced(
          existingNotarial.file.id,
          existingNotarial.file.key,
        );
      }

      const incomingFileHash = await getFileHash(incomingFile);
      const targetFolder = normalizeGaragePath(parsedData.data.path);
      const uploadKey =
        parsedData.data.path != null
          ? buildFolderUploadKey(targetFolder, incomingFile)
          : generateFileKey({
              ...mergedData,
              fileHash: incomingFileHash,
            });
      if (!uploadKey) {
        return {
          success: false,
          error: "Notarial updated but generated file key is empty.",
        };
      }

      const updatedFile = await uploadFileToGarage(
        incomingFile,
        uploadKey,
        "",
        NOTARIAL_GARAGE_BUCKET,
        NOTARIAL_GARAGE_ROOT,
      );

      if (!updatedFile.success) {
        return {
          success: false,
          error:
            "Notarial updated but file upload failed: " + updatedFile.error,
        };
      }

      await prisma.notarial.update({
        where: { id },
        data: {
          fileId: updatedFile.result.id,
        },
      });
    } else if (existingNotarial.file) {
      const nextKey = generateFileKey({
        ...mergedData,
        fileHash: existingNotarial.file.fileHash,
      });
      const nextStorageKey = nextKey ? scopeNotarialStorageKey(nextKey) : "";
      if (nextStorageKey && nextStorageKey !== existingNotarial.file.key) {
        await moveGarageFile(
          existingNotarial.file.key,
          nextStorageKey,
          "",
          NOTARIAL_GARAGE_BUCKET,
        );
      }
    }

    const notarialWithFile = await prisma.notarial.findUnique({
      where: { id },
      include: { file: true },
    });

    if (!notarialWithFile) {
      return {
        success: false,
        error: "Notarial updated but failed to retrieve with file data",
      };
    }

    return { success: true, result: notarialWithFile };
  } catch (error) {
    console.error("Error updating notarial data:", error);
    return { success: false, error: "Error updating notarial data" };
  }
}

export async function deleteNotarial(id: number): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const notarial = await prisma.notarial.findUnique({
      where: { id },
      include: { file: true },
    });

    if (!notarial) {
      return { success: false, error: "Notarial data not found" };
    }

    await prisma.notarial.delete({ where: { id } });

    if (notarial.file) {
      await deleteFileIfUnreferenced(notarial.file.id, notarial.file.key);
    }

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting notarial data:", error);
    return { success: false, error: "Error deleting notarial data" };
  }
}

export async function getNotarialFileUrl(
  id: number,
  options?: GetFileOptions,
): Promise<ActionResult<string>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const notarial = await prisma.notarial.findUnique({
      where: { id },
      include: { file: true },
    });

    if (!notarial) {
      return { success: false, error: "Notarial data not found" };
    }

    if (!notarial.file) {
      return { success: false, error: "No file associated with this notarial" };
    }

    const urlResult = await getGarageFileUrl(
      notarial.file.key,
      options,
      NOTARIAL_GARAGE_BUCKET,
    );

    if (!urlResult.success) {
      return {
        success: false,
        error: "Failed to get file URL: " + urlResult.error,
      };
    }
    return { success: true, result: urlResult.result };
  } catch (error) {
    console.error("Error getting notarial file URL:", error);
    return { success: false, error: "Error getting notarial file URL" };
  }
}

export async function acquireNotarialEditLock(
  recordId: number,
  options?: NotarialEditLockOptions,
): Promise<
  ActionResult<
    {
      lockId: string;
      heartbeatIntervalMs: number;
      syncIntervalMs: number;
      expiresInSeconds: number;
    },
    NotarialEditLockErrorResult
  >
> {
  try {
    const sessionValidation = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    if (!Number.isInteger(recordId) || recordId <= 0) {
      return { success: false, error: "Invalid notarial record id" };
    }

    const record = await prisma.notarial.findUnique({
      where: { id: recordId },
      include: { file: true },
    });

    if (!record || !record.file) {
      return { success: false, error: "Notarial file not found" };
    }

    if (!isOfficeEditableNotarialFile(record)) {
      return {
        success: false,
        error: "Only Word and Excel files can be opened for desktop editing.",
      };
    }

    const requestDeviceId = normalizeDeviceId(options?.deviceId);
    const lockKey = getNotarialEditLockKey(recordId);
    const existing = parseNotarialEditLockPayload(
      await redisConnection.get(lockKey),
    );

    if (existing) {
      const nowIso = new Date().toISOString();
      if (
        existing.userId === sessionValidation.result.id &&
        requestDeviceId &&
        existing.deviceId === requestDeviceId
      ) {
        const refreshed = await refreshNotarialEditLock(existing.lockId, {
          ...existing,
          deviceId: requestDeviceId,
          heartbeatAt: nowIso,
        });

        if (refreshed) {
          return {
            success: true,
            result: {
              lockId: existing.lockId,
              heartbeatIntervalMs: NOTARIAL_EDIT_HEARTBEAT_INTERVAL_MS,
              syncIntervalMs: NOTARIAL_EDIT_SYNC_INTERVAL_MS,
              expiresInSeconds: NOTARIAL_EDIT_LOCK_TTL_SECONDS,
            },
          };
        }

        await clearNotarialEditLock(lockKey, existing.lockId);
      } else if (isLockStale(existing.heartbeatAt)) {
        await clearNotarialEditLock(lockKey, existing.lockId);
      } else {
        const lockedBySelf = existing.userId === sessionValidation.result.id;
        return {
          success: false,
          error: lockedBySelf
            ? `This file is already locked by you on another device (${existing.lockId.slice(0, 8)}).`
            : `File is currently being edited by ${existing.userDisplayName}.`,
          errorResult: {
            code: "locked",
            lockId: existing.lockId,
            lockedBy: existing.userDisplayName,
            lockDeviceId: existing.deviceId ?? null,
          },
        };
      }
    }

    const lockId = randomUUID();
    const nowIso = new Date().toISOString();
    const payload: NotarialEditLockPayload = {
      lockId,
      recordId,
      userId: sessionValidation.result.id,
      userDisplayName:
        sessionValidation.result.name ||
        sessionValidation.result.email ||
        "Unknown user",
      deviceId: requestDeviceId,
      acquiredAt: nowIso,
      heartbeatAt: nowIso,
    };

    const acquired = await redisConnection.set(
      lockKey,
      JSON.stringify(payload),
      "EX",
      NOTARIAL_EDIT_LOCK_TTL_SECONDS,
      "NX",
    );

    if (acquired !== "OK") {
      return {
        success: false,
        error:
          "Unable to acquire lock. Another user may have opened this file.",
      };
    }

    await redisConnection.set(
      getNotarialEditTokenKey(lockId),
      String(recordId),
      "EX",
      NOTARIAL_EDIT_LOCK_TTL_SECONDS,
    );

    return {
      success: true,
      result: {
        lockId,
        heartbeatIntervalMs: NOTARIAL_EDIT_HEARTBEAT_INTERVAL_MS,
        syncIntervalMs: NOTARIAL_EDIT_SYNC_INTERVAL_MS,
        expiresInSeconds: NOTARIAL_EDIT_LOCK_TTL_SECONDS,
      },
    };
  } catch (error) {
    console.error("Error acquiring notarial edit lock:", error);
    return { success: false, error: "Failed to lock notarial file" };
  }
}

export async function heartbeatNotarialEditLock(
  lockId: string,
): Promise<ActionResult<{ expiresInSeconds: number }>> {
  try {
    const sessionValidation = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const normalizedLockId = String(lockId || "").trim();
    if (!normalizedLockId) {
      return { success: false, error: "Lock id is required" };
    }

    const tokenKey = getNotarialEditTokenKey(normalizedLockId);
    const recordIdRaw = await redisConnection.get(tokenKey);
    const recordId = Number(recordIdRaw);
    if (!Number.isInteger(recordId) || recordId <= 0) {
      return { success: false, error: "Notarial edit lock has expired." };
    }

    const lockKey = getNotarialEditLockKey(recordId);
    const payload = parseNotarialEditLockPayload(
      await redisConnection.get(lockKey),
    );
    if (!payload || payload.lockId !== normalizedLockId) {
      return { success: false, error: "Notarial edit lock has expired." };
    }

    if (payload.userId !== sessionValidation.result.id) {
      return {
        success: false,
        error: "This lock belongs to another user.",
      };
    }

    const refreshed = await refreshNotarialEditLock(normalizedLockId, {
      ...payload,
      heartbeatAt: new Date().toISOString(),
    });

    if (!refreshed) {
      return { success: false, error: "Notarial edit lock has expired." };
    }

    return {
      success: true,
      result: {
        expiresInSeconds: NOTARIAL_EDIT_LOCK_TTL_SECONDS,
      },
    };
  } catch (error) {
    console.error("Error heartbeat for notarial edit lock:", error);
    return { success: false, error: "Failed to refresh notarial lock" };
  }
}

export async function releaseNotarialEditLock(
  lockId: string,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const normalizedLockId = String(lockId || "").trim();
    if (!normalizedLockId) {
      return { success: false, error: "Lock id is required" };
    }

    const tokenKey = getNotarialEditTokenKey(normalizedLockId);
    const recordIdRaw = await redisConnection.get(tokenKey);
    const recordId = Number(recordIdRaw);
    if (!Number.isInteger(recordId) || recordId <= 0) {
      return { success: true, result: undefined };
    }

    const lockKey = getNotarialEditLockKey(recordId);

    await redisConnection.eval(
      `
        local tokenKey = KEYS[1]
        local lockKey = KEYS[2]
        local expectedRecordId = ARGV[1]
        local expectedLockId = ARGV[2]
        local expectedUserId = ARGV[3]

        local recordId = redis.call('GET', tokenKey)
        if not recordId or recordId ~= expectedRecordId then
          return 0
        end

        local lockPayload = redis.call('GET', lockKey)
        if lockPayload then
          local ok, decoded = pcall(cjson.decode, lockPayload)
          if ok and decoded and decoded['lockId'] == expectedLockId and decoded['userId'] == expectedUserId then
            redis.call('DEL', lockKey)
          end
        end

        redis.call('DEL', tokenKey)
        return 1
      `,
      2,
      tokenKey,
      lockKey,
      String(recordId),
      normalizedLockId,
      sessionValidation.result.id,
    );

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error releasing notarial edit lock:", error);
    return { success: false, error: "Failed to release notarial lock" };
  }
}

export async function syncNotarialEditedFile(
  lockId: string,
  file: File,
): Promise<ActionResult<{ updatedAt: string }>> {
  try {
    const sessionValidation = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const normalizedLockId = String(lockId || "").trim();
    if (!normalizedLockId) {
      return { success: false, error: "Lock id is required" };
    }

    if (!(file instanceof File)) {
      return { success: false, error: "Edited file payload is required" };
    }

    const entryIdRaw = await redisConnection.get(
      getNotarialEditTokenKey(normalizedLockId),
    );
    const recordId = Number(entryIdRaw);
    if (!Number.isInteger(recordId) || recordId <= 0) {
      return { success: false, error: "Notarial edit lock has expired." };
    }

    const lockPayload = parseNotarialEditLockPayload(
      await redisConnection.get(getNotarialEditLockKey(recordId)),
    );
    if (!lockPayload || lockPayload.lockId !== normalizedLockId) {
      return { success: false, error: "Notarial edit lock has expired." };
    }

    if (lockPayload.userId !== sessionValidation.result.id) {
      return {
        success: false,
        error: "This lock belongs to another user.",
      };
    }

    const record = await prisma.notarial.findUnique({
      where: { id: recordId },
      include: { file: true },
    });

    if (!record || !record.file) {
      return { success: false, error: "Notarial file not found" };
    }

    if (!isOfficeEditableNotarialFile(record)) {
      return {
        success: false,
        error:
          "Only Word and Excel files can be synced through desktop editing.",
      };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash("sha256").update(buffer).digest("hex");
    const contentType =
      file.type || record.file.mimeType || "application/octet-stream";
    const fileName = file.name || record.file.fileName || "notarial-file";

    const garageClient = await getGarageClient();
    await garageClient.send(
      new PutObjectCommand({
        Bucket: NOTARIAL_GARAGE_BUCKET,
        Key: record.file.key,
        Body: new Uint8Array(buffer),
        ContentType: contentType,
      }),
    );

    const nowIso = new Date().toISOString();
    await prisma.fileData.update({
      where: { id: record.file.id },
      data: {
        fileHash,
        fileName,
        size: file.size,
        mimeType: contentType,
      },
    });

    const refreshed = await refreshNotarialEditLock(normalizedLockId, {
      ...lockPayload,
      heartbeatAt: nowIso,
    });
    if (!refreshed) {
      return { success: false, error: "Notarial edit lock has expired." };
    }

    return {
      success: true,
      result: { updatedAt: nowIso },
    };
  } catch (error) {
    console.error("Error syncing edited notarial file:", error);
    return { success: false, error: "Failed to sync edited notarial file" };
  }
}

export async function acquireNotarialGarageEditLock(
  garageKey: string,
  options?: NotarialEditLockOptions,
): Promise<
  ActionResult<
    {
      lockId: string;
      heartbeatIntervalMs: number;
      syncIntervalMs: number;
      expiresInSeconds: number;
    },
    NotarialEditLockErrorResult
  >
> {
  try {
    const sessionValidation = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const normalizedKey = normalizeNotarialGarageKey(garageKey);
    if (!normalizedKey) {
      return { success: false, error: "Garage file key is required" };
    }

    const requestDeviceId = normalizeDeviceId(options?.deviceId);
    const lockKey = getNotarialGarageEditLockKey(normalizedKey);
    const existing = parseNotarialGarageEditLockPayload(
      await redisConnection.get(lockKey),
    );

    if (existing) {
      const nowIso = new Date().toISOString();
      if (
        existing.userId === sessionValidation.result.id &&
        requestDeviceId &&
        existing.deviceId === requestDeviceId
      ) {
        const refreshed = await refreshNotarialGarageEditLock(existing.lockId, {
          ...existing,
          deviceId: requestDeviceId,
          heartbeatAt: nowIso,
        });

        if (refreshed) {
          return {
            success: true,
            result: {
              lockId: existing.lockId,
              heartbeatIntervalMs: NOTARIAL_EDIT_HEARTBEAT_INTERVAL_MS,
              syncIntervalMs: NOTARIAL_EDIT_SYNC_INTERVAL_MS,
              expiresInSeconds: NOTARIAL_EDIT_LOCK_TTL_SECONDS,
            },
          };
        }

        await clearNotarialEditLock(lockKey, existing.lockId);
      } else if (isLockStale(existing.heartbeatAt)) {
        await clearNotarialEditLock(lockKey, existing.lockId);
      } else {
        const lockedBySelf = existing.userId === sessionValidation.result.id;
        return {
          success: false,
          error: lockedBySelf
            ? `This file is already locked by you on another device (${existing.lockId.slice(0, 8)}).`
            : `File is currently being edited by ${existing.userDisplayName}.`,
          errorResult: {
            code: "locked",
            lockId: existing.lockId,
            lockedBy: existing.userDisplayName,
            lockDeviceId: existing.deviceId ?? null,
          },
        };
      }
    }

    const lockId = randomUUID();
    const nowIso = new Date().toISOString();
    const payload: NotarialGarageEditLockPayload = {
      lockId,
      garageKey: normalizedKey,
      userId: sessionValidation.result.id,
      userDisplayName:
        sessionValidation.result.name ||
        sessionValidation.result.email ||
        "Unknown user",
      deviceId: requestDeviceId,
      acquiredAt: nowIso,
      heartbeatAt: nowIso,
    };

    const acquired = await redisConnection.set(
      lockKey,
      JSON.stringify(payload),
      "EX",
      NOTARIAL_EDIT_LOCK_TTL_SECONDS,
      "NX",
    );
    if (acquired !== "OK") {
      return {
        success: false,
        error:
          "Unable to acquire lock. Another user may have opened this file.",
      };
    }

    await redisConnection.set(
      getNotarialEditTokenKey(lockId),
      getNotarialGarageLockScopeKey(normalizedKey),
      "EX",
      NOTARIAL_EDIT_LOCK_TTL_SECONDS,
    );

    return {
      success: true,
      result: {
        lockId,
        heartbeatIntervalMs: NOTARIAL_EDIT_HEARTBEAT_INTERVAL_MS,
        syncIntervalMs: NOTARIAL_EDIT_SYNC_INTERVAL_MS,
        expiresInSeconds: NOTARIAL_EDIT_LOCK_TTL_SECONDS,
      },
    };
  } catch (error) {
    console.error("Error acquiring notarial garage edit lock:", error);
    return { success: false, error: "Failed to lock notarial garage file" };
  }
}

export async function heartbeatNotarialGarageEditLock(
  lockId: string,
): Promise<ActionResult<{ expiresInSeconds: number }>> {
  try {
    const sessionValidation = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const normalizedLockId = String(lockId || "").trim();
    if (!normalizedLockId) {
      return { success: false, error: "Lock id is required" };
    }

    const lockScope = await redisConnection.get(
      getNotarialEditTokenKey(normalizedLockId),
    );
    if (!lockScope) {
      return { success: false, error: "Notarial edit lock has expired." };
    }

    const allGarageLocks = await redisConnection.keys(
      "notarial:edit-lock:garage:*",
    );
    let payload: NotarialGarageEditLockPayload | null = null;
    for (const key of allGarageLocks) {
      const candidate = parseNotarialGarageEditLockPayload(
        await redisConnection.get(key),
      );
      if (candidate?.lockId === normalizedLockId) {
        payload = candidate;
        break;
      }
    }

    if (!payload) {
      return { success: false, error: "Notarial edit lock has expired." };
    }

    if (payload.userId !== sessionValidation.result.id) {
      return {
        success: false,
        error: "This lock belongs to another user.",
      };
    }

    const refreshed = await refreshNotarialGarageEditLock(normalizedLockId, {
      ...payload,
      heartbeatAt: new Date().toISOString(),
    });
    if (!refreshed) {
      return { success: false, error: "Notarial edit lock has expired." };
    }

    return {
      success: true,
      result: {
        expiresInSeconds: NOTARIAL_EDIT_LOCK_TTL_SECONDS,
      },
    };
  } catch (error) {
    console.error("Error heartbeat for notarial garage edit lock:", error);
    return { success: false, error: "Failed to refresh notarial garage lock" };
  }
}

export async function releaseNotarialGarageEditLock(
  lockId: string,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const normalizedLockId = String(lockId || "").trim();
    if (!normalizedLockId) {
      return { success: false, error: "Lock id is required" };
    }

    const lockScope = await redisConnection.get(
      getNotarialEditTokenKey(normalizedLockId),
    );
    if (!lockScope) {
      return { success: true, result: undefined };
    }

    const allGarageLocks = await redisConnection.keys(
      "notarial:edit-lock:garage:*",
    );
    for (const key of allGarageLocks) {
      const payload = parseNotarialGarageEditLockPayload(
        await redisConnection.get(key),
      );
      if (
        payload?.lockId === normalizedLockId &&
        payload.userId === sessionValidation.result.id
      ) {
        await redisConnection.del(key);
        break;
      }
    }

    await redisConnection.del(getNotarialEditTokenKey(normalizedLockId));
    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error releasing notarial garage edit lock:", error);
    return { success: false, error: "Failed to release notarial garage lock" };
  }
}

export async function syncNotarialGarageEditedFile(
  lockId: string,
  file: File,
): Promise<ActionResult<{ updatedAt: string }>> {
  try {
    const sessionValidation = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const normalizedLockId = String(lockId || "").trim();
    if (!normalizedLockId) {
      return { success: false, error: "Lock id is required" };
    }

    if (!(file instanceof File)) {
      return { success: false, error: "Edited file payload is required" };
    }

    const allGarageLocks = await redisConnection.keys(
      "notarial:edit-lock:garage:*",
    );
    let payload: NotarialGarageEditLockPayload | null = null;
    for (const key of allGarageLocks) {
      const candidate = parseNotarialGarageEditLockPayload(
        await redisConnection.get(key),
      );
      if (candidate?.lockId === normalizedLockId) {
        payload = candidate;
        break;
      }
    }

    if (!payload) {
      return { success: false, error: "Notarial edit lock has expired." };
    }

    if (payload.userId !== sessionValidation.result.id) {
      return {
        success: false,
        error: "This lock belongs to another user.",
      };
    }

    const normalizedKey = normalizeNotarialGarageKey(payload.garageKey);
    const contentType = file.type || "application/octet-stream";
    const fileName = file.name || normalizedKey.split("/").pop() || "file";
    const fileHash = createHash("sha256")
      .update(Buffer.from(await file.arrayBuffer()))
      .digest("hex");

    const uploadResult = await uploadFileToGarageTrusted(
      file,
      normalizedKey,
      "",
      NOTARIAL_GARAGE_BUCKET,
      NOTARIAL_GARAGE_ROOT,
    );

    if (!uploadResult.success) {
      const garageClient = await getGarageClient();
      const scopedKey = scopeNotarialStorageKey(normalizedKey);
      await garageClient.send(
        new PutObjectCommand({
          Bucket: NOTARIAL_GARAGE_BUCKET,
          Key: scopedKey,
          Body: new Uint8Array(await file.arrayBuffer()),
          ContentType: contentType,
        }),
      );

      const existing = await prisma.fileData.findUnique({
        where: {
          key: scopedKey,
        },
      });
      if (existing) {
        await prisma.fileData.update({
          where: { id: existing.id },
          data: {
            fileHash,
            fileName,
            path: scopedKey.includes("/")
              ? scopedKey.slice(0, scopedKey.lastIndexOf("/"))
              : "",
            size: file.size,
            mimeType: contentType,
          },
        });
      }
    }

    const refreshed = await refreshNotarialGarageEditLock(normalizedLockId, {
      ...payload,
      heartbeatAt: new Date().toISOString(),
    });
    if (!refreshed) {
      return { success: false, error: "Notarial edit lock has expired." };
    }

    return {
      success: true,
      result: { updatedAt: new Date().toISOString() },
    };
  } catch (error) {
    console.error("Error syncing edited notarial garage file:", error);
    return {
      success: false,
      error: "Failed to sync edited notarial garage file",
    };
  }
}

export async function getNotarialGarageDirectoryItems(
  folderPath = "",
): Promise<ActionResult<GarageItem[]>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    return await listGarageFolder(
      folderPath,
      NOTARIAL_GARAGE_BUCKET,
      NOTARIAL_GARAGE_ROOT,
    );
  } catch (error) {
    console.error("Error fetching notarial garage directory:", error);
    return { success: false, error: "Failed to fetch garage directory" };
  }
}

export async function getNotarialGarageFileUrl(
  key: string,
  options?: GetFileOptions,
): Promise<ActionResult<string>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    return await getGarageFileUrl(
      key,
      options,
      NOTARIAL_GARAGE_BUCKET,
      NOTARIAL_GARAGE_ROOT,
    );
  } catch (error) {
    console.error("Error getting notarial garage file URL:", error);
    return { success: false, error: "Failed to get garage file URL" };
  }
}

export async function deleteNotarialGarageItems(
  keys: string[],
): Promise<ActionResult<{ deletedCount: number }>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const result = await deleteGarageKeys(
      keys,
      NOTARIAL_GARAGE_BUCKET,
      NOTARIAL_GARAGE_ROOT,
    );
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      result: {
        deletedCount: result.result.deletedCount,
      },
    };
  } catch (error) {
    console.error("Error deleting notarial garage items:", error);
    return { success: false, error: "Failed to delete Garage items" };
  }
}

export async function moveNotarialGarageItems(
  keys: string[],
  targetFolderPath: string,
): Promise<ActionResult<{ movedCount: number }>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const result = await moveGarageKeys(
      keys,
      targetFolderPath,
      NOTARIAL_GARAGE_BUCKET,
      NOTARIAL_GARAGE_ROOT,
    );
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      result: {
        movedCount: result.result.movedCount,
      },
    };
  } catch (error) {
    console.error("Error moving notarial garage items:", error);
    return { success: false, error: "Failed to move Garage items" };
  }
}

export async function renameNotarialGarageItem(
  key: string,
  newName: string,
): Promise<ActionResult<{ movedCount: number }>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const result = await renameGarageKey(
      key,
      newName,
      NOTARIAL_GARAGE_BUCKET,
      NOTARIAL_GARAGE_ROOT,
    );
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      result: {
        movedCount: result.result.movedCount,
      },
    };
  } catch (error) {
    console.error("Error renaming notarial garage item:", error);
    return { success: false, error: "Failed to rename Garage item" };
  }
}

export async function getRecentNotarialFiles(
  limit = 5,
): Promise<ActionResult<NotarialRecentFile[]>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const normalizedLimit = Math.min(Math.max(Math.trunc(limit || 5), 1), 20);

    const items = await prisma.notarial.findMany({
      where: {
        fileId: {
          not: null,
        },
      },
      include: {
        file: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: normalizedLimit,
    });

    return {
      success: true,
      result: items
        .filter((item) => !!item.file)
        .map((item) => ({
          id: item.id,
          fileName:
            item.file?.fileName?.trim() ||
            item.title?.trim() ||
            "Untitled File",
          title: item.title,
          name: item.name,
          attorney: item.attorney,
          mimeType: item.file?.mimeType ?? null,
          uploadedAt: item.file?.createdAt ?? item.createdAt,
        })),
    };
  } catch (error) {
    console.error("Error fetching recent notarial files:", error);
    return { success: false, error: "Failed to fetch recent notarial files" };
  }
}

export async function createGarageFolder(
  data: Record<string, unknown>,
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_ACCESS_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const name = String(data?.name ?? "").trim();
    const parentPath = String(data?.parentPath ?? "").trim();

    if (!name) {
      return { success: false, error: "Folder name is required" };
    }

    if (name.includes("/") || name.includes("\\")) {
      return { success: false, error: "Enter a folder name without slashes" };
    }

    const cleanedParent = normalizeGaragePath(parentPath);
    const fullPath = cleanedParent ? `${cleanedParent}/${name}` : name;
    const existingItems = await listGarageFolder(
      cleanedParent,
      NOTARIAL_GARAGE_BUCKET,
      NOTARIAL_GARAGE_ROOT,
    );
    if (
      existingItems.success &&
      existingItems.result.some(
        (item) =>
          item.isDirectory && item.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      return { success: false, error: "A folder already exists at that path" };
    }

    const result = await createGarageFolderMarker(
      fullPath,
      NOTARIAL_GARAGE_BUCKET,
      NOTARIAL_GARAGE_ROOT,
    );
    if (!result.success) return { success: false, error: result.error };

    return {
      success: true,
      result: {
        id: 0,
        name,
        parentPath: cleanedParent,
        fullPath,
      },
    };
  } catch (error) {
    console.error("Error creating garage folder:", error);
    return { success: false, error: "Failed to create folder" };
  }
}
