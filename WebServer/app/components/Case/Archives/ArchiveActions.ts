"use server";

import { validateSession } from "@/app/lib/authActions";
import { getGarageClient } from "@/app/lib/garage";
import {
  createGarageFolderMarker,
  deleteGarageFile,
  deleteGarageKeys,
  GARAGE_ARCHIVES_ROOT,
  getGarageFileUrl,
  listGarageFolder,
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
  ArchiveEditLockErrorResult,
  ArchiveEditLockOptions,
  ArchiveEntryData,
  ArchiveEntryInput,
  ArchiveEntryInputSchema,
  ArchiveEntryType,
  ArchiveFilterOptions,
  ArchiveSpreadsheetData,
  ArchiveStats,
  DEFAULT_ARCHIVE_SHEET_COLS,
  DEFAULT_ARCHIVE_SHEET_ROWS,
  getArchiveBaseName,
  getArchiveExtension,
  getArchiveParentPath,
  joinArchivePath,
  normalizeArchiveName,
  normalizeArchivePath,
  PaginatedResult,
} from "@rtc-database/shared";
import { Prisma } from "@rtc-database/shared/prisma/client";
import { createHash, randomUUID } from "crypto";
import * as XLSX from "xlsx";

const ARCHIVE_ACCESS_ROLES = [Roles.ARCHIVE, Roles.ADMIN, Roles.NOTARIAL];
const ARCHIVE_GARAGE_BUCKET = "rtc-bucket";
const ARCHIVE_GARAGE_ROOT = GARAGE_ARCHIVES_ROOT;
const ARCHIVE_INCLUDE = {
  file: true,
} satisfies Prisma.ArchiveEntryInclude;

const SPREADSHEET_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const SPREADSHEET_EXTENSIONS = new Set(["xlsx", "xls", "csv"]);
const OFFICE_EDITABLE_EXTENSIONS = new Set(["doc", "docx", "xls", "xlsx"]);
const OFFICE_EDITABLE_MIME_TOKENS = [
  "word",
  "wordprocessingml",
  "excel",
  "spreadsheet",
  "officedocument",
];
const DOCUMENT_EXTENSIONS = new Set([
  "txt",
  "md",
  "html",
  "htm",
  "json",
  "xml",
]);

type ArchiveFileReference = {
  id: number;
  key: string;
};

type GarageMovePair = {
  oldKey: string;
  newKey: string;
};

type PreparedArchiveEntry = {
  entryType: ArchiveEntryType;
  extension: string | null;
  textContent: string | null;
  sheetData: ArchiveSpreadsheetData | null;
  uploadFile: File | null;
};

export type ArchiveRecentItem = {
  id: number;
  name: string;
  entryType: ArchiveEntryType;
  parentPath: string;
  mimeType: string | null;
  updatedAt: Date;
};

const normalizeNullableString = (value?: string | null): string | null => {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
};

const ARCHIVE_EDIT_LOCK_TTL_SECONDS = 45;
const ARCHIVE_EDIT_HEARTBEAT_INTERVAL_MS = 10_000;
const ARCHIVE_EDIT_SYNC_INTERVAL_MS = 15_000;
const ARCHIVE_EDIT_STALE_GRACE_MS = Math.max(
  5000,
  Math.min(
    ARCHIVE_EDIT_LOCK_TTL_SECONDS * 1000 - 5000,
    ARCHIVE_EDIT_HEARTBEAT_INTERVAL_MS * 3,
  ),
);

type ArchiveEditLockPayload = {
  lockId: string;
  entryId: number;
  userId: string;
  userDisplayName: string;
  deviceId?: string | null;
  acquiredAt: string;
  heartbeatAt: string;
};

type ArchiveGarageEditLockPayload = {
  lockId: string;
  garageKey: string;
  userId: string;
  userDisplayName: string;
  deviceId?: string | null;
  acquiredAt: string;
  heartbeatAt: string;
};

const getArchiveEditLockKey = (entryId: number): string =>
  `archive:edit-lock:entry:${entryId}`;

const getArchiveEditTokenKey = (lockId: string): string =>
  `archive:edit-lock:token:${lockId}`;

const normalizeGarageEditKey = (garageKey: string): string =>
  String(garageKey || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");

const getArchiveGarageLockScopeKey = (garageKey: string): string => {
  const normalized = normalizeGarageEditKey(garageKey);
  return createHash("sha256").update(normalized).digest("hex");
};

const getArchiveGarageEditLockKey = (garageKey: string): string =>
  `archive:edit-lock:garage:${getArchiveGarageLockScopeKey(garageKey)}`;

const parseArchiveEditLockPayload = (
  raw: string | null,
): ArchiveEditLockPayload | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ArchiveEditLockPayload>;
    if (
      typeof parsed.lockId !== "string" ||
      typeof parsed.entryId !== "number" ||
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
      entryId: parsed.entryId,
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

const parseArchiveGarageEditLockPayload = (
  raw: string | null,
): ArchiveGarageEditLockPayload | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ArchiveGarageEditLockPayload>;
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

  return Date.now() - heartbeatMs > ARCHIVE_EDIT_STALE_GRACE_MS;
};

const clearArchiveEditLock = async (lockKey: string, lockId: string) => {
  await redisConnection.del(lockKey);
  await redisConnection.del(getArchiveEditTokenKey(lockId));
};

const isOfficeEditableArchiveFile = (entry: {
  name: string;
  extension?: string | null;
  file?: { mimeType: string } | null;
}): boolean => {
  const extension = (entry.extension || getArchiveExtension(entry.name) || "")
    .toLowerCase()
    .trim();
  if (OFFICE_EDITABLE_EXTENSIONS.has(extension)) {
    return true;
  }

  const mimeType = (entry.file?.mimeType || "").toLowerCase();
  return OFFICE_EDITABLE_MIME_TOKENS.some((token) => mimeType.includes(token));
};

const refreshArchiveEditLock = async (
  lockId: string,
  nextPayload: ArchiveEditLockPayload,
): Promise<boolean> => {
  const tokenKey = getArchiveEditTokenKey(lockId);
  const lockKey = getArchiveEditLockKey(nextPayload.entryId);
  const payloadJson = JSON.stringify(nextPayload);

  const updated = await redisConnection.eval(
    `
      local tokenKey = KEYS[1]
      local lockKey = KEYS[2]
      local expectedEntryId = ARGV[1]
      local expectedLockId = ARGV[2]
      local payload = ARGV[3]
      local ttl = tonumber(ARGV[4])

      local entryId = redis.call('GET', tokenKey)
      if not entryId or entryId ~= expectedEntryId then
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
      redis.call('SET', tokenKey, expectedEntryId, 'EX', ttl)
      return 1
    `,
    2,
    tokenKey,
    lockKey,
    String(nextPayload.entryId),
    lockId,
    payloadJson,
    String(ARCHIVE_EDIT_LOCK_TTL_SECONDS),
  );

  return updated === 1;
};

const refreshArchiveGarageEditLock = async (
  lockId: string,
  nextPayload: ArchiveGarageEditLockPayload,
): Promise<boolean> => {
  const tokenKey = getArchiveEditTokenKey(lockId);
  const lockScope = getArchiveGarageLockScopeKey(nextPayload.garageKey);
  const lockKey = getArchiveGarageEditLockKey(nextPayload.garageKey);
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
    String(ARCHIVE_EDIT_LOCK_TTL_SECONDS),
  );

  return updated === 1;
};

const defaultExtensionForType = (entryType: ArchiveEntryType): string => {
  switch (entryType) {
    case ArchiveEntryType.SPREADSHEET:
      return "xlsx";
    case ArchiveEntryType.DOCUMENT:
      return "txt";
    default:
      return "";
  }
};

const ensureFileExtension = (
  name: string,
  extension?: string | null,
): string => {
  const normalizedName = normalizeArchiveName(name);
  const normalizedExtension = (extension ?? "").trim().replace(/^\./, "");

  if (!normalizedExtension) {
    return normalizedName;
  }

  return normalizedName
    .toLowerCase()
    .endsWith(`.${normalizedExtension.toLowerCase()}`)
    ? normalizedName
    : `${normalizedName}.${normalizedExtension}`;
};

const resolveArchiveEntryName = (
  name: string,
  entryType: ArchiveEntryType,
  extension?: string | null,
): string => {
  const normalizedName = normalizeArchiveName(name);
  if (entryType === ArchiveEntryType.FOLDER) {
    return normalizedName;
  }

  const resolvedExtension =
    (extension ?? "").trim() ||
    getArchiveExtension(normalizedName) ||
    defaultExtensionForType(entryType);

  return ensureFileExtension(normalizedName, resolvedExtension);
};

const buildArchiveStorageKey = (
  parentPath: string,
  fileName: string,
): string => {
  return joinArchivePath(parentPath, fileName);
};

const normalizeSheetData = (value: unknown): ArchiveSpreadsheetData => {
  if (!Array.isArray(value) || value.length === 0) {
    return Array.from({ length: DEFAULT_ARCHIVE_SHEET_ROWS }, () =>
      Array.from({ length: DEFAULT_ARCHIVE_SHEET_COLS }, () => ""),
    );
  }

  const rows = value.map((row) => {
    if (!Array.isArray(row)) {
      return [row == null ? "" : String(row)];
    }

    return row.map((cell) => (cell == null ? "" : String(cell)));
  });

  const maxCols = Math.max(1, ...rows.map((row) => row.length));
  return rows.map((row) =>
    Array.from({ length: maxCols }, (_unused, index) => row[index] ?? ""),
  );
};

const createDocumentFile = (
  fileName: string,
  textContent: string,
  extension?: string | null,
): File => {
  const resolvedExtension = extension || getArchiveExtension(fileName) || "txt";
  const resolvedFileName = ensureFileExtension(fileName, resolvedExtension);
  const contentType =
    resolvedExtension === "json"
      ? "application/json"
      : resolvedExtension === "html" || resolvedExtension === "htm"
        ? "text/html"
        : "text/plain";

  return new File([textContent], resolvedFileName, { type: contentType });
};

const createSpreadsheetFile = (
  fileName: string,
  sheetData: ArchiveSpreadsheetData,
): File => {
  const resolvedFileName = ensureFileExtension(fileName, "xlsx");
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });

  return new File([buffer], resolvedFileName, {
    type: SPREADSHEET_MIME,
  });
};

const parseSpreadsheetUpload = async (
  file: File,
): Promise<ArchiveSpreadsheetData> => {
  const extension = getArchiveExtension(file.name);

  if (extension === "csv") {
    const csvText = await file.text();
    const workbook = XLSX.read(csvText, { type: "string" });
    const firstSheetName = workbook.SheetNames[0];
    const firstSheet = firstSheetName
      ? workbook.Sheets[firstSheetName]
      : undefined;
    const rows = firstSheet
      ? (XLSX.utils.sheet_to_json(firstSheet, {
          header: 1,
          defval: "",
        }) as unknown[])
      : [];

    return normalizeSheetData(rows);
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = firstSheetName
    ? workbook.Sheets[firstSheetName]
    : undefined;
  const rows = firstSheet
    ? (XLSX.utils.sheet_to_json(firstSheet, {
        header: 1,
        defval: "",
      }) as unknown[])
    : [];

  return normalizeSheetData(rows);
};

const parseUploadedFile = async (
  file: File,
): Promise<{
  detectedType: ArchiveEntryType;
  extension: string | null;
  textContent: string | null;
  sheetData: ArchiveSpreadsheetData | null;
}> => {
  const extension = getArchiveExtension(file.name) || null;
  const mimeType = (file.type || "").toLowerCase();

  if (extension && SPREADSHEET_EXTENSIONS.has(extension)) {
    return {
      detectedType: ArchiveEntryType.SPREADSHEET,
      extension,
      textContent: null,
      sheetData: await parseSpreadsheetUpload(file),
    };
  }

  if (
    (extension && DOCUMENT_EXTENSIONS.has(extension)) ||
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml"
  ) {
    return {
      detectedType: ArchiveEntryType.DOCUMENT,
      extension,
      textContent: await file.text(),
      sheetData: null,
    };
  }

  return {
    detectedType: ArchiveEntryType.FILE,
    extension,
    textContent: null,
    sheetData: null,
  };
};

const uploadPreparedFile = async (
  parentPath: string,
  fileName: string,
  file: File,
): Promise<ActionResult<ArchiveFileReference>> => {
  const key = buildArchiveStorageKey(parentPath, fileName);
  const uploadResult = await uploadFileToGarage(
    file,
    key,
    "",
    ARCHIVE_GARAGE_BUCKET,
    ARCHIVE_GARAGE_ROOT,
  );

  if (!uploadResult.success) {
    return {
      success: false,
      error: uploadResult.error || "Failed to upload archive file",
    };
  }

  return {
    success: true,
    result: {
      id: uploadResult.result.id,
      key: uploadResult.result.key,
    },
  };
};

const deleteFileIfUnreferenced = async (file?: ArchiveFileReference | null) => {
  if (!file) return;

  const [archiveRefs, notarialRefs, chatRefs] = await prisma.$transaction([
    prisma.archiveEntry.count({ where: { fileId: file.id } }),
    prisma.notarial.count({ where: { fileId: file.id } }),
    prisma.chatMessage.count({ where: { fileId: file.id } }),
  ]);

  if (archiveRefs === 0 && notarialRefs === 0 && chatRefs === 0) {
    await deleteGarageFile(file.key, ARCHIVE_GARAGE_BUCKET);
  }
};

const prepareArchiveEntry = async (
  input: ArchiveEntryInput,
): Promise<ActionResult<PreparedArchiveEntry>> => {
  if (input.entryType === ArchiveEntryType.FOLDER) {
    return {
      success: true,
      result: {
        entryType: ArchiveEntryType.FOLDER,
        extension: null,
        textContent: null,
        sheetData: null,
        uploadFile: null,
      },
    };
  }

  if (input.file) {
    const parsedUpload = await parseUploadedFile(input.file);

    if (input.entryType === ArchiveEntryType.FILE) {
      if (parsedUpload.detectedType === ArchiveEntryType.DOCUMENT) {
        const fileName = resolveArchiveEntryName(
          input.name || input.file.name,
          ArchiveEntryType.DOCUMENT,
          parsedUpload.extension,
        );
        const textContent = parsedUpload.textContent ?? "";

        return {
          success: true,
          result: {
            entryType: ArchiveEntryType.DOCUMENT,
            extension: getArchiveExtension(fileName) || parsedUpload.extension,
            textContent,
            sheetData: null,
            uploadFile: createDocumentFile(
              fileName,
              textContent,
              parsedUpload.extension,
            ),
          },
        };
      }

      if (parsedUpload.detectedType === ArchiveEntryType.SPREADSHEET) {
        const fileName = resolveArchiveEntryName(
          input.name || input.file.name,
          ArchiveEntryType.SPREADSHEET,
          parsedUpload.extension,
        );
        const sheetData = parsedUpload.sheetData ?? normalizeSheetData([]);

        return {
          success: true,
          result: {
            entryType: ArchiveEntryType.SPREADSHEET,
            extension: "xlsx",
            textContent: null,
            sheetData,
            uploadFile: createSpreadsheetFile(fileName, sheetData),
          },
        };
      }

      return {
        success: true,
        result: {
          entryType: ArchiveEntryType.FILE,
          extension: parsedUpload.extension,
          textContent: null,
          sheetData: null,
          uploadFile: input.file,
        },
      };
    }

    if (input.entryType === ArchiveEntryType.DOCUMENT) {
      const textContent =
        parsedUpload.textContent ??
        normalizeNullableString(input.textContent) ??
        "";
      const resolvedName = resolveArchiveEntryName(
        input.name || input.file.name,
        ArchiveEntryType.DOCUMENT,
        input.extension || parsedUpload.extension,
      );

      return {
        success: true,
        result: {
          entryType: ArchiveEntryType.DOCUMENT,
          extension: getArchiveExtension(resolvedName),
          textContent,
          sheetData: null,
          uploadFile: createDocumentFile(
            resolvedName,
            textContent,
            getArchiveExtension(resolvedName),
          ),
        },
      };
    }

    if (input.entryType === ArchiveEntryType.SPREADSHEET) {
      const sheetData =
        parsedUpload.sheetData ?? normalizeSheetData(input.sheetData);
      const resolvedName = resolveArchiveEntryName(
        input.name || input.file.name,
        ArchiveEntryType.SPREADSHEET,
        "xlsx",
      );

      return {
        success: true,
        result: {
          entryType: ArchiveEntryType.SPREADSHEET,
          extension: "xlsx",
          textContent: null,
          sheetData,
          uploadFile: createSpreadsheetFile(resolvedName, sheetData),
        },
      };
    }
  }

  if (input.entryType === ArchiveEntryType.DOCUMENT) {
    const resolvedName = resolveArchiveEntryName(
      input.name,
      ArchiveEntryType.DOCUMENT,
      input.extension,
    );
    const textContent = normalizeNullableString(input.textContent) ?? "";

    return {
      success: true,
      result: {
        entryType: ArchiveEntryType.DOCUMENT,
        extension: getArchiveExtension(resolvedName) || "txt",
        textContent,
        sheetData: null,
        uploadFile: createDocumentFile(
          resolvedName,
          textContent,
          getArchiveExtension(resolvedName) || "txt",
        ),
      },
    };
  }

  if (input.entryType === ArchiveEntryType.SPREADSHEET) {
    const resolvedName = resolveArchiveEntryName(
      input.name,
      ArchiveEntryType.SPREADSHEET,
      "xlsx",
    );
    const sheetData = normalizeSheetData(input.sheetData);

    return {
      success: true,
      result: {
        entryType: ArchiveEntryType.SPREADSHEET,
        extension: "xlsx",
        textContent: null,
        sheetData,
        uploadFile: createSpreadsheetFile(resolvedName, sheetData),
      },
    };
  }

  return {
    success: true,
    result: {
      entryType: ArchiveEntryType.FILE,
      extension: input.extension || getArchiveExtension(input.name) || null,
      textContent: null,
      sheetData: null,
      uploadFile: null,
    },
  };
};

const buildArchiveWhere = (
  options?: ArchiveFilterOptions,
): Prisma.ArchiveEntryWhereInput => {
  const filters = options?.filters;
  const searchValue = normalizeNullableString(filters?.search);
  const parentPath = filters?.parentPath;
  const conditions: Prisma.ArchiveEntryWhereInput[] = [];

  if (searchValue) {
    conditions.push({
      OR: [
        {
          name: {
            contains: searchValue,
          },
        },
        {
          description: {
            contains: searchValue,
          },
        },
        {
          fullPath: {
            contains: searchValue,
          },
        },
      ],
    });
  }

  if (typeof parentPath === "string") {
    conditions.push({
      parentPath: normalizeArchivePath(parentPath),
    });
  }

  if (filters?.entryType) {
    conditions.push({
      entryType: filters.entryType,
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
};

const buildArchiveOrderBy = (
  options?: ArchiveFilterOptions,
): Prisma.ArchiveEntryOrderByWithRelationInput[] => {
  const sortKey = options?.sortKey ?? "updatedAt";
  const sortOrder = options?.sortOrder ?? "desc";

  if (sortKey === "name") {
    return [{ entryType: "asc" }, { name: sortOrder }];
  }

  if (sortKey === "entryType") {
    return [{ entryType: sortOrder }, { name: "asc" }];
  }

  return [{ entryType: "asc" }, { [sortKey]: sortOrder }, { name: "asc" }];
};

const fetchArchiveEntry = (id: number) =>
  prisma.archiveEntry.findUnique({
    where: { id },
    include: ARCHIVE_INCLUDE,
  });

const syncArchiveMovedGarageKeys = async (movedKeys: GarageMovePair[]) => {
  const normalizedPairs = movedKeys
    .map((pair) => ({
      oldPath: normalizeArchivePath(pair.oldKey.replace(/\/$/, "")),
      newPath: normalizeArchivePath(pair.newKey.replace(/\/$/, "")),
    }))
    .filter((pair) => pair.oldPath && pair.newPath);

  if (normalizedPairs.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const pair of normalizedPairs) {
      const entries = await tx.archiveEntry.findMany({
        where: {
          OR: [
            { fullPath: pair.oldPath },
            {
              fullPath: {
                startsWith: `${pair.oldPath}/`,
              },
            },
          ],
        },
        orderBy: {
          fullPath: "asc",
        },
      });

      for (const entry of entries) {
        const suffix = entry.fullPath.slice(pair.oldPath.length);
        const nextFullPath = `${pair.newPath}${suffix}`;

        await tx.archiveEntry.update({
          where: { id: entry.id },
          data: {
            fullPath: nextFullPath,
            parentPath: getArchiveParentPath(nextFullPath),
            name: getArchiveBaseName(nextFullPath),
          },
        });
      }
    }
  });
};

export async function getArchiveEntriesPage(
  options?: ArchiveFilterOptions,
): Promise<ActionResult<PaginatedResult<ArchiveEntryData>>> {
  try {
    const sessionValidation = await validateSession(ARCHIVE_ACCESS_ROLES);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const page = options?.page && options.page > 0 ? options.page : 1;
    const pageSize =
      options?.pageSize && options.pageSize > 0 ? options.pageSize : 25;
    const where = buildArchiveWhere(options);
    const orderBy = buildArchiveOrderBy(options);

    const [items, total] = await prisma.$transaction([
      prisma.archiveEntry.findMany({
        where,
        include: ARCHIVE_INCLUDE,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.archiveEntry.count({ where }),
    ]);

    return {
      success: true,
      result: {
        items,
        total,
      },
    };
  } catch (error) {
    console.error("Error fetching archive entries:", error);
    return { success: false, error: "Failed to fetch archive entries" };
  }
}

export async function getArchiveStats(
  options?: ArchiveFilterOptions,
): Promise<ActionResult<ArchiveStats>> {
  try {
    const sessionValidation = await validateSession(ARCHIVE_ACCESS_ROLES);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const where = buildArchiveWhere(options);

    const [totalItems, folders, editableItems, uploadedFiles, fileSizes] =
      await prisma.$transaction([
        prisma.archiveEntry.count({ where }),
        prisma.archiveEntry.count({
          where: {
            AND: [where, { entryType: ArchiveEntryType.FOLDER }],
          },
        }),
        prisma.archiveEntry.count({
          where: {
            AND: [
              where,
              {
                entryType: {
                  in: [ArchiveEntryType.DOCUMENT, ArchiveEntryType.SPREADSHEET],
                },
              },
            ],
          },
        }),
        prisma.archiveEntry.count({
          where: {
            AND: [where, { entryType: ArchiveEntryType.FILE }],
          },
        }),
        prisma.archiveEntry.findMany({
          where,
          select: {
            file: {
              select: {
                size: true,
              },
            },
          },
        }),
      ]);

    const storageUsedBytes = fileSizes.reduce(
      (total, item) => total + (item.file?.size ?? 0),
      0,
    );

    return {
      success: true,
      result: {
        totalItems,
        folders,
        editableItems,
        uploadedFiles,
        storageUsedBytes,
      },
    };
  } catch (error) {
    console.error("Error fetching archive stats:", error);
    return { success: false, error: "Failed to fetch archive stats" };
  }
}

export async function getArchiveEntryById(
  id: string | number,
): Promise<ActionResult<ArchiveEntryData>> {
  try {
    const sessionValidation = await validateSession(ARCHIVE_ACCESS_ROLES);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const parsedId = Number(id);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return { success: false, error: "Invalid archive entry id" };
    }

    const entry = await fetchArchiveEntry(parsedId);
    if (!entry) {
      return { success: false, error: "Archive entry not found" };
    }

    return { success: true, result: entry };
  } catch (error) {
    console.error("Error fetching archive entry:", error);
    return { success: false, error: "Failed to fetch archive entry" };
  }
}

export async function getArchiveEntriesByIds(
  ids: Array<string | number>,
): Promise<ActionResult<ArchiveEntryData[]>> {
  try {
    const sessionValidation = await validateSession(ARCHIVE_ACCESS_ROLES);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const parsedIds = Array.from(
      new Set(
        ids
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    );

    if (parsedIds.length === 0) {
      return { success: false, error: "No valid archive ids provided" };
    }

    const entries = await prisma.archiveEntry.findMany({
      where: {
        id: {
          in: parsedIds,
        },
      },
      include: ARCHIVE_INCLUDE,
    });

    const orderMap = new Map(parsedIds.map((id, index) => [id, index]));
    const orderedEntries = entries.sort(
      (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
    );

    if (orderedEntries.length !== parsedIds.length) {
      return {
        success: false,
        error: "One or more archive entries were not found",
      };
    }

    return {
      success: true,
      result: orderedEntries,
    };
  } catch (error) {
    console.error("Error fetching archive entries by ids:", error);
    return { success: false, error: "Failed to fetch archive entries" };
  }
}

export async function getArchiveFileUrl(
  id: number,
  options?: {
    inline?: boolean;
    fileName?: string;
    contentType?: string;
  },
): Promise<ActionResult<string>> {
  try {
    const sessionValidation = await validateSession(ARCHIVE_ACCESS_ROLES);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const entry = await fetchArchiveEntry(id);
    if (!entry) {
      return { success: false, error: "Archive entry not found" };
    }

    if (!entry.file) {
      return { success: false, error: "No file stored for this archive entry" };
    }

    return await getGarageFileUrl(
      entry.file.key,
      {
        inline: options?.inline,
        fileName: options?.fileName || entry.name || entry.file.fileName,
        contentType: options?.contentType || entry.file.mimeType,
      },
      ARCHIVE_GARAGE_BUCKET,
    );
  } catch (error) {
    console.error("Error getting archive file URL:", error);
    return { success: false, error: "Failed to get archive file URL" };
  }
}

export async function getArchiveGarageDirectoryItems(
  folderPath = "",
): Promise<ActionResult<GarageItem[]>> {
  try {
    const sessionValidation = await validateSession(ARCHIVE_ACCESS_ROLES);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    return await listGarageFolder(
      folderPath,
      ARCHIVE_GARAGE_BUCKET,
      ARCHIVE_GARAGE_ROOT,
    );
  } catch (error) {
    console.error("Error fetching archive garage directory:", error);
    return { success: false, error: "Failed to fetch garage directory" };
  }
}

export async function getArchiveGarageFileUrl(
  key: string,
  options?: {
    inline?: boolean;
    fileName?: string;
    contentType?: string;
  },
): Promise<ActionResult<string>> {
  try {
    const sessionValidation = await validateSession(ARCHIVE_ACCESS_ROLES);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    return await getGarageFileUrl(
      key,
      options,
      ARCHIVE_GARAGE_BUCKET,
      ARCHIVE_GARAGE_ROOT,
    );
  } catch (error) {
    console.error("Error getting archive garage file URL:", error);
    return { success: false, error: "Failed to get garage file URL" };
  }
}

export async function acquireArchiveEditLock(
  entryId: number,
  options?: ArchiveEditLockOptions,
): Promise<
  ActionResult<
    {
      lockId: string;
      heartbeatIntervalMs: number;
      syncIntervalMs: number;
      expiresInSeconds: number;
    },
    ArchiveEditLockErrorResult
  >
> {
  try {
    const sessionValidation = await validateSession(ARCHIVE_ACCESS_ROLES);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    if (!Number.isInteger(entryId) || entryId <= 0) {
      return { success: false, error: "Invalid archive entry id" };
    }

    const entry = await fetchArchiveEntry(entryId);
    if (!entry || !entry.file) {
      return { success: false, error: "Archive file not found" };
    }

    if (!isOfficeEditableArchiveFile(entry)) {
      return {
        success: false,
        error: "Only Word and Excel files can be opened for desktop editing.",
      };
    }

    const requestDeviceId = normalizeDeviceId(options?.deviceId);
    const lockKey = getArchiveEditLockKey(entryId);
    const existing = parseArchiveEditLockPayload(
      await redisConnection.get(lockKey),
    );
    if (existing) {
      const nowIso = new Date().toISOString();
      if (
        existing.userId === sessionValidation.result.id &&
        requestDeviceId &&
        existing.deviceId === requestDeviceId
      ) {
        const refreshed = await refreshArchiveEditLock(existing.lockId, {
          ...existing,
          deviceId: requestDeviceId,
          heartbeatAt: nowIso,
        });

        if (refreshed) {
          return {
            success: true,
            result: {
              lockId: existing.lockId,
              heartbeatIntervalMs: ARCHIVE_EDIT_HEARTBEAT_INTERVAL_MS,
              syncIntervalMs: ARCHIVE_EDIT_SYNC_INTERVAL_MS,
              expiresInSeconds: ARCHIVE_EDIT_LOCK_TTL_SECONDS,
            },
          };
        }

        await clearArchiveEditLock(lockKey, existing.lockId);
      } else if (isLockStale(existing.heartbeatAt)) {
        await clearArchiveEditLock(lockKey, existing.lockId);
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
    const payload: ArchiveEditLockPayload = {
      lockId,
      entryId,
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
      ARCHIVE_EDIT_LOCK_TTL_SECONDS,
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
      getArchiveEditTokenKey(lockId),
      String(entryId),
      "EX",
      ARCHIVE_EDIT_LOCK_TTL_SECONDS,
    );

    return {
      success: true,
      result: {
        lockId,
        heartbeatIntervalMs: ARCHIVE_EDIT_HEARTBEAT_INTERVAL_MS,
        syncIntervalMs: ARCHIVE_EDIT_SYNC_INTERVAL_MS,
        expiresInSeconds: ARCHIVE_EDIT_LOCK_TTL_SECONDS,
      },
    };
  } catch (error) {
    console.error("Error acquiring archive edit lock:", error);
    return { success: false, error: "Failed to lock archive file" };
  }
}

export async function heartbeatArchiveEditLock(
  lockId: string,
): Promise<ActionResult<{ expiresInSeconds: number }>> {
  try {
    const sessionValidation = await validateSession(ARCHIVE_ACCESS_ROLES);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const normalizedLockId = String(lockId || "").trim();
    if (!normalizedLockId) {
      return { success: false, error: "Lock id is required" };
    }

    const tokenKey = getArchiveEditTokenKey(normalizedLockId);
    const entryIdRaw = await redisConnection.get(tokenKey);
    const entryId = Number(entryIdRaw);
    if (!Number.isInteger(entryId) || entryId <= 0) {
      return { success: false, error: "Archive edit lock has expired." };
    }

    const lockKey = getArchiveEditLockKey(entryId);
    const payload = parseArchiveEditLockPayload(
      await redisConnection.get(lockKey),
    );
    if (!payload || payload.lockId !== normalizedLockId) {
      return { success: false, error: "Archive edit lock has expired." };
    }

    if (payload.userId !== sessionValidation.result.id) {
      return {
        success: false,
        error: "This lock belongs to another user.",
      };
    }

    const refreshed = await refreshArchiveEditLock(normalizedLockId, {
      ...payload,
      heartbeatAt: new Date().toISOString(),
    });

    if (!refreshed) {
      return { success: false, error: "Archive edit lock has expired." };
    }

    return {
      success: true,
      result: {
        expiresInSeconds: ARCHIVE_EDIT_LOCK_TTL_SECONDS,
      },
    };
  } catch (error) {
    console.error("Error heartbeat for archive edit lock:", error);
    return { success: false, error: "Failed to refresh archive lock" };
  }
}

export async function releaseArchiveEditLock(
  lockId: string,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession(ARCHIVE_ACCESS_ROLES);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const normalizedLockId = String(lockId || "").trim();
    if (!normalizedLockId) {
      return { success: false, error: "Lock id is required" };
    }

    const tokenKey = getArchiveEditTokenKey(normalizedLockId);
    const entryIdRaw = await redisConnection.get(tokenKey);
    const entryId = Number(entryIdRaw);
    if (!Number.isInteger(entryId) || entryId <= 0) {
      return { success: true, result: undefined };
    }

    const lockKey = getArchiveEditLockKey(entryId);

    await redisConnection.eval(
      `
        local tokenKey = KEYS[1]
        local lockKey = KEYS[2]
        local expectedEntryId = ARGV[1]
        local expectedLockId = ARGV[2]
        local expectedUserId = ARGV[3]

        local entryId = redis.call('GET', tokenKey)
        if not entryId or entryId ~= expectedEntryId then
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
      String(entryId),
      normalizedLockId,
      sessionValidation.result.id,
    );

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error releasing archive edit lock:", error);
    return { success: false, error: "Failed to release archive lock" };
  }
}

export async function syncArchiveEditedFile(
  lockId: string,
  file: File,
): Promise<ActionResult<{ updatedAt: string }>> {
  try {
    const sessionValidation = await validateSession(ARCHIVE_ACCESS_ROLES);
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
      getArchiveEditTokenKey(normalizedLockId),
    );
    const entryId = Number(entryIdRaw);
    if (!Number.isInteger(entryId) || entryId <= 0) {
      return { success: false, error: "Archive edit lock has expired." };
    }

    const lockPayload = parseArchiveEditLockPayload(
      await redisConnection.get(getArchiveEditLockKey(entryId)),
    );
    if (!lockPayload || lockPayload.lockId !== normalizedLockId) {
      return { success: false, error: "Archive edit lock has expired." };
    }

    if (lockPayload.userId !== sessionValidation.result.id) {
      return {
        success: false,
        error: "This lock belongs to another user.",
      };
    }

    const entry = await fetchArchiveEntry(entryId);
    if (!entry || !entry.file) {
      return { success: false, error: "Archive file not found" };
    }

    if (!isOfficeEditableArchiveFile(entry)) {
      return {
        success: false,
        error:
          "Only Word and Excel files can be synced through desktop editing.",
      };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash("sha256").update(buffer).digest("hex");
    const contentType =
      file.type || entry.file.mimeType || "application/octet-stream";
    const fileName = file.name || entry.file.fileName;

    const garageClient = await getGarageClient();
    await garageClient.send(
      new PutObjectCommand({
        Bucket: ARCHIVE_GARAGE_BUCKET,
        Key: entry.file.key,
        Body: new Uint8Array(buffer),
        ContentType: contentType,
      }),
    );

    const nowIso = new Date().toISOString();
    await prisma.$transaction([
      prisma.fileData.update({
        where: { id: entry.file.id },
        data: {
          fileHash,
          fileName,
          size: file.size,
          mimeType: contentType,
        },
      }),
      prisma.archiveEntry.update({
        where: { id: entry.id },
        data: {
          extension: getArchiveExtension(fileName) || entry.extension,
        },
      }),
    ]);

    const refreshed = await refreshArchiveEditLock(normalizedLockId, {
      ...lockPayload,
      heartbeatAt: nowIso,
    });
    if (!refreshed) {
      return { success: false, error: "Archive edit lock has expired." };
    }

    return {
      success: true,
      result: { updatedAt: nowIso },
    };
  } catch (error) {
    console.error("Error syncing edited archive file:", error);
    return { success: false, error: "Failed to sync edited archive file" };
  }
}

export async function acquireArchiveGarageEditLock(
  garageKey: string,
  options?: ArchiveEditLockOptions,
): Promise<
  ActionResult<
    {
      lockId: string;
      heartbeatIntervalMs: number;
      syncIntervalMs: number;
      expiresInSeconds: number;
    },
    ArchiveEditLockErrorResult
  >
> {
  try {
    const sessionValidation = await validateSession(ARCHIVE_ACCESS_ROLES);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const normalizedKey = normalizeGarageEditKey(garageKey);
    if (!normalizedKey) {
      return { success: false, error: "Garage file key is required" };
    }

    const requestDeviceId = normalizeDeviceId(options?.deviceId);
    const lockKey = getArchiveGarageEditLockKey(normalizedKey);
    const existing = parseArchiveGarageEditLockPayload(
      await redisConnection.get(lockKey),
    );
    if (existing) {
      const nowIso = new Date().toISOString();
      if (
        existing.userId === sessionValidation.result.id &&
        requestDeviceId &&
        existing.deviceId === requestDeviceId
      ) {
        const refreshed = await refreshArchiveGarageEditLock(existing.lockId, {
          ...existing,
          deviceId: requestDeviceId,
          heartbeatAt: nowIso,
        });

        if (refreshed) {
          return {
            success: true,
            result: {
              lockId: existing.lockId,
              heartbeatIntervalMs: ARCHIVE_EDIT_HEARTBEAT_INTERVAL_MS,
              syncIntervalMs: ARCHIVE_EDIT_SYNC_INTERVAL_MS,
              expiresInSeconds: ARCHIVE_EDIT_LOCK_TTL_SECONDS,
            },
          };
        }

        await clearArchiveEditLock(lockKey, existing.lockId);
      } else if (isLockStale(existing.heartbeatAt)) {
        await clearArchiveEditLock(lockKey, existing.lockId);
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
    const payload: ArchiveGarageEditLockPayload = {
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
      ARCHIVE_EDIT_LOCK_TTL_SECONDS,
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
      getArchiveEditTokenKey(lockId),
      getArchiveGarageLockScopeKey(normalizedKey),
      "EX",
      ARCHIVE_EDIT_LOCK_TTL_SECONDS,
    );

    return {
      success: true,
      result: {
        lockId,
        heartbeatIntervalMs: ARCHIVE_EDIT_HEARTBEAT_INTERVAL_MS,
        syncIntervalMs: ARCHIVE_EDIT_SYNC_INTERVAL_MS,
        expiresInSeconds: ARCHIVE_EDIT_LOCK_TTL_SECONDS,
      },
    };
  } catch (error) {
    console.error("Error acquiring archive garage edit lock:", error);
    return { success: false, error: "Failed to lock archive garage file" };
  }
}

export async function heartbeatArchiveGarageEditLock(
  lockId: string,
): Promise<ActionResult<{ expiresInSeconds: number }>> {
  try {
    const sessionValidation = await validateSession(ARCHIVE_ACCESS_ROLES);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const normalizedLockId = String(lockId || "").trim();
    if (!normalizedLockId) {
      return { success: false, error: "Lock id is required" };
    }

    const lockScope = await redisConnection.get(
      getArchiveEditTokenKey(normalizedLockId),
    );
    if (!lockScope) {
      return { success: false, error: "Archive edit lock has expired." };
    }

    const allGarageLocks = await redisConnection.keys(
      "archive:edit-lock:garage:*",
    );
    let payload: ArchiveGarageEditLockPayload | null = null;
    for (const key of allGarageLocks) {
      const candidate = parseArchiveGarageEditLockPayload(
        await redisConnection.get(key),
      );
      if (candidate?.lockId === normalizedLockId) {
        payload = candidate;
        break;
      }
    }

    if (!payload) {
      return { success: false, error: "Archive edit lock has expired." };
    }

    if (payload.userId !== sessionValidation.result.id) {
      return {
        success: false,
        error: "This lock belongs to another user.",
      };
    }

    const refreshed = await refreshArchiveGarageEditLock(normalizedLockId, {
      ...payload,
      heartbeatAt: new Date().toISOString(),
    });
    if (!refreshed) {
      return { success: false, error: "Archive edit lock has expired." };
    }

    return {
      success: true,
      result: {
        expiresInSeconds: ARCHIVE_EDIT_LOCK_TTL_SECONDS,
      },
    };
  } catch (error) {
    console.error("Error heartbeat for archive garage edit lock:", error);
    return { success: false, error: "Failed to refresh archive garage lock" };
  }
}

export async function releaseArchiveGarageEditLock(
  lockId: string,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession(ARCHIVE_ACCESS_ROLES);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const normalizedLockId = String(lockId || "").trim();
    if (!normalizedLockId) {
      return { success: false, error: "Lock id is required" };
    }

    const lockScope = await redisConnection.get(
      getArchiveEditTokenKey(normalizedLockId),
    );
    if (!lockScope) {
      return { success: true, result: undefined };
    }

    const allGarageLocks = await redisConnection.keys(
      "archive:edit-lock:garage:*",
    );
    for (const key of allGarageLocks) {
      const payload = parseArchiveGarageEditLockPayload(
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

    await redisConnection.del(getArchiveEditTokenKey(normalizedLockId));
    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error releasing archive garage edit lock:", error);
    return { success: false, error: "Failed to release archive garage lock" };
  }
}

export async function syncArchiveGarageEditedFile(
  lockId: string,
  file: File,
): Promise<ActionResult<{ updatedAt: string }>> {
  try {
    const sessionValidation = await validateSession(ARCHIVE_ACCESS_ROLES);
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
      "archive:edit-lock:garage:*",
    );
    let payload: ArchiveGarageEditLockPayload | null = null;
    for (const key of allGarageLocks) {
      const candidate = parseArchiveGarageEditLockPayload(
        await redisConnection.get(key),
      );
      if (candidate?.lockId === normalizedLockId) {
        payload = candidate;
        break;
      }
    }

    if (!payload) {
      return { success: false, error: "Archive edit lock has expired." };
    }

    if (payload.userId !== sessionValidation.result.id) {
      return {
        success: false,
        error: "This lock belongs to another user.",
      };
    }

    const normalizedKey = normalizeGarageEditKey(payload.garageKey);
    const contentType = file.type || "application/octet-stream";
    const fileName = file.name || normalizedKey.split("/").pop() || "file";
    const fileHash = createHash("sha256")
      .update(Buffer.from(await file.arrayBuffer()))
      .digest("hex");

    const uploadResult = await uploadFileToGarageTrusted(
      file,
      normalizedKey,
      "",
      ARCHIVE_GARAGE_BUCKET,
      ARCHIVE_GARAGE_ROOT,
    );

    if (!uploadResult.success) {
      // Trusted uploader rejects same-key updates if hash changed; fallback to direct overwrite.
      const garageClient = await getGarageClient();
      const scopedKey = joinArchivePath(ARCHIVE_GARAGE_ROOT, normalizedKey);
      await garageClient.send(
        new PutObjectCommand({
          Bucket: ARCHIVE_GARAGE_BUCKET,
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

    const refreshed = await refreshArchiveGarageEditLock(normalizedLockId, {
      ...payload,
      heartbeatAt: new Date().toISOString(),
    });
    if (!refreshed) {
      return { success: false, error: "Archive edit lock has expired." };
    }

    return {
      success: true,
      result: { updatedAt: new Date().toISOString() },
    };
  } catch (error) {
    console.error("Error syncing edited archive garage file:", error);
    return {
      success: false,
      error: "Failed to sync edited garage archive file",
    };
  }
}

export async function deleteArchiveGarageItems(
  keys: string[],
): Promise<ActionResult<{ deletedCount: number }>> {
  try {
    const sessionValidation = await validateSession(ARCHIVE_ACCESS_ROLES);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const normalizedKeys = Array.from(
      new Set(
        keys
          .map((key) =>
            String(key || "")
              .replace(/\\/g, "/")
              .trim()
              .replace(/^\/+/, ""),
          )
          .filter((key) => key.length > 0),
      ),
    );

    if (normalizedKeys.length === 0) {
      return { success: false, error: "No archive items selected" };
    }

    const deleteResult = await deleteGarageKeys(
      normalizedKeys,
      ARCHIVE_GARAGE_BUCKET,
      ARCHIVE_GARAGE_ROOT,
    );
    if (!deleteResult.success) {
      return { success: false, error: deleteResult.error };
    }

    const exactPaths = normalizedKeys.map((key) => key.replace(/\/$/, ""));
    const folderPrefixes = normalizedKeys
      .filter((key) => key.endsWith("/"))
      .map((key) => key.replace(/\/$/, ""));
    const deleteConditions: Prisma.ArchiveEntryWhereInput[] = [
      {
        fullPath: {
          in: exactPaths,
        },
      },
    ];

    for (const prefix of folderPrefixes) {
      deleteConditions.push({
        fullPath: {
          startsWith: `${prefix}/`,
        },
      });
    }

    await prisma.archiveEntry.deleteMany({
      where: {
        OR: deleteConditions,
      },
    });

    return {
      success: true,
      result: {
        deletedCount: deleteResult.result.deletedCount,
      },
    };
  } catch (error) {
    console.error("Error deleting archive garage items:", error);
    return { success: false, error: "Failed to delete archive Garage items" };
  }
}

export async function moveArchiveGarageItems(
  keys: string[],
  targetFolderPath: string,
): Promise<ActionResult<{ movedCount: number }>> {
  try {
    const sessionValidation = await validateSession(ARCHIVE_ACCESS_ROLES);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const result = await moveGarageKeys(
      keys,
      targetFolderPath,
      ARCHIVE_GARAGE_BUCKET,
      ARCHIVE_GARAGE_ROOT,
    );
    if (!result.success) {
      return { success: false, error: result.error };
    }

    await syncArchiveMovedGarageKeys(result.result.movedKeys);

    return {
      success: true,
      result: {
        movedCount: result.result.movedCount,
      },
    };
  } catch (error) {
    console.error("Error moving archive garage items:", error);
    return { success: false, error: "Failed to move archive Garage items" };
  }
}

export async function renameArchiveGarageItem(
  key: string,
  newName: string,
): Promise<ActionResult<{ movedCount: number }>> {
  try {
    const sessionValidation = await validateSession(ARCHIVE_ACCESS_ROLES);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const result = await renameGarageKey(
      key,
      newName,
      ARCHIVE_GARAGE_BUCKET,
      ARCHIVE_GARAGE_ROOT,
    );
    if (!result.success) {
      return { success: false, error: result.error };
    }

    await syncArchiveMovedGarageKeys(result.result.movedKeys);

    return {
      success: true,
      result: {
        movedCount: result.result.movedCount,
      },
    };
  } catch (error) {
    console.error("Error renaming archive garage item:", error);
    return { success: false, error: "Failed to rename archive Garage item" };
  }
}

export async function createArchiveEntry(
  data: Record<string, unknown>,
): Promise<ActionResult<ArchiveEntryData>> {
  try {
    const sessionValidation = await validateSession(ARCHIVE_ACCESS_ROLES);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const parsed = ArchiveEntryInputSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Invalid archive entry payload" };
    }

    const prepared = await prepareArchiveEntry(parsed.data);
    if (!prepared.success) {
      return prepared;
    }

    const parentPath = normalizeArchivePath(parsed.data.parentPath);
    const resolvedName = resolveArchiveEntryName(
      parsed.data.name,
      prepared.result.entryType,
      prepared.result.extension,
    );
    const fullPath = joinArchivePath(parentPath, resolvedName);

    if (!resolvedName) {
      return { success: false, error: "Archive name is required" };
    }

    const existing = await prisma.archiveEntry.findFirst({
      where: {
        parentPath,
        name: resolvedName,
      },
    });
    if (existing) {
      return {
        success: false,
        error: "An archive entry with the same name already exists here",
      };
    }

    if (prepared.result.entryType === ArchiveEntryType.FOLDER) {
      const folderMarkerResult = await createGarageFolderMarker(
        fullPath,
        ARCHIVE_GARAGE_BUCKET,
        ARCHIVE_GARAGE_ROOT,
      );
      if (!folderMarkerResult.success) {
        return {
          success: false,
          error:
            folderMarkerResult.error ||
            "Failed to create archive folder in Garage",
        };
      }
    }

    let fileId: number | null = null;
    if (prepared.result.uploadFile) {
      const uploadResult = await uploadPreparedFile(
        parentPath,
        resolvedName,
        prepared.result.uploadFile,
      );
      if (!uploadResult.success) {
        return uploadResult;
      }
      fileId = uploadResult.result.id;
    } else if (prepared.result.entryType === ArchiveEntryType.FILE) {
      return {
        success: false,
        error: "A file upload is required for file archive entries",
      };
    }

    const createdEntry = await prisma.archiveEntry.create({
      data: {
        name: resolvedName,
        parentPath,
        fullPath,
        entryType: prepared.result.entryType,
        description: normalizeNullableString(parsed.data.description),
        extension: prepared.result.extension,
        textContent: prepared.result.textContent,
        sheetData:
          prepared.result.sheetData == null
            ? Prisma.JsonNull
            : (prepared.result.sheetData as Prisma.InputJsonValue),
        fileId,
      },
      include: ARCHIVE_INCLUDE,
    });

    return {
      success: true,
      result: createdEntry,
    };
  } catch (error) {
    console.error("Error creating archive entry:", error);
    return { success: false, error: "Failed to create archive entry" };
  }
}

export async function updateArchiveEntry(
  id: number,
  data: Record<string, unknown>,
): Promise<ActionResult<ArchiveEntryData>> {
  try {
    const sessionValidation = await validateSession(ARCHIVE_ACCESS_ROLES);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const existingEntry = await fetchArchiveEntry(id);
    if (!existingEntry) {
      return { success: false, error: "Archive entry not found" };
    }

    const parsed = ArchiveEntryInputSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Invalid archive entry payload" };
    }

    const requestedType = parsed.data.entryType;
    if (
      existingEntry.entryType === ArchiveEntryType.FOLDER &&
      requestedType !== ArchiveEntryType.FOLDER
    ) {
      return {
        success: false,
        error: "Folders cannot be converted into files or documents",
      };
    }

    if (
      existingEntry.entryType !== ArchiveEntryType.FOLDER &&
      requestedType === ArchiveEntryType.FOLDER
    ) {
      return {
        success: false,
        error: "Existing files cannot be converted into folders",
      };
    }

    const prepared = await prepareArchiveEntry(parsed.data);
    if (!prepared.success) {
      return prepared;
    }

    const parentPath = normalizeArchivePath(parsed.data.parentPath);
    const resolvedName = resolveArchiveEntryName(
      parsed.data.name,
      prepared.result.entryType,
      prepared.result.extension || existingEntry.extension,
    );
    const fullPath = joinArchivePath(parentPath, resolvedName);

    const conflictingEntry = await prisma.archiveEntry.findFirst({
      where: {
        parentPath,
        name: resolvedName,
        id: {
          not: id,
        },
      },
    });
    if (conflictingEntry) {
      return {
        success: false,
        error: "An archive entry with the same name already exists here",
      };
    }

    if (existingEntry.entryType === ArchiveEntryType.FOLDER) {
      const descendants = await prisma.archiveEntry.findMany({
        where: {
          fullPath: {
            startsWith: `${existingEntry.fullPath}/`,
          },
        },
        orderBy: {
          fullPath: "asc",
        },
      });

      const descendantIds = descendants.map((entry) => entry.id);
      const conflictingDescendants = await prisma.archiveEntry.count({
        where: {
          id: {
            notIn: [id, ...descendantIds],
          },
          OR: [
            {
              fullPath,
            },
            {
              fullPath: {
                startsWith: `${fullPath}/`,
              },
            },
          ],
        },
      });

      if (conflictingDescendants > 0) {
        return {
          success: false,
          error: "The target folder path already exists",
        };
      }

      await prisma.$transaction(async (tx) => {
        await tx.archiveEntry.update({
          where: { id },
          data: {
            name: resolvedName,
            parentPath,
            fullPath,
            description: normalizeNullableString(parsed.data.description),
          },
        });

        for (const descendant of descendants) {
          const suffix = descendant.fullPath.slice(
            existingEntry.fullPath.length,
          );
          const nextFullPath = `${fullPath}${suffix}`;

          await tx.archiveEntry.update({
            where: { id: descendant.id },
            data: {
              fullPath: nextFullPath,
              parentPath: getArchiveParentPath(nextFullPath),
              name: getArchiveBaseName(nextFullPath),
            },
          });
        }
      });

      const updatedFolder = await fetchArchiveEntry(id);
      if (!updatedFolder) {
        return {
          success: false,
          error: "Archive folder updated but could not be reloaded",
        };
      }

      return { success: true, result: updatedFolder };
    }

    let nextFileId = existingEntry.fileId ?? null;
    let replacedFile: ArchiveFileReference | null = null;

    if (prepared.result.uploadFile) {
      const uploadResult = await uploadPreparedFile(
        parentPath,
        resolvedName,
        prepared.result.uploadFile,
      );
      if (!uploadResult.success) {
        return uploadResult;
      }

      nextFileId = uploadResult.result.id;
      replacedFile = existingEntry.file
        ? {
            id: existingEntry.file.id,
            key: existingEntry.file.key,
          }
        : null;
    } else if (
      prepared.result.entryType === ArchiveEntryType.FILE &&
      !nextFileId
    ) {
      return {
        success: false,
        error: "A file is required for file archive entries",
      };
    }

    const updatedEntry = await prisma.archiveEntry.update({
      where: { id },
      data: {
        name: resolvedName,
        parentPath,
        fullPath,
        entryType: prepared.result.entryType,
        description: normalizeNullableString(parsed.data.description),
        extension:
          prepared.result.extension ||
          existingEntry.extension ||
          getArchiveExtension(resolvedName) ||
          null,
        textContent: prepared.result.textContent,
        sheetData:
          prepared.result.sheetData == null
            ? Prisma.JsonNull
            : (prepared.result.sheetData as Prisma.InputJsonValue),
        fileId: nextFileId,
      },
      include: ARCHIVE_INCLUDE,
    });

    if (replacedFile && replacedFile.id !== updatedEntry.fileId) {
      await deleteFileIfUnreferenced(replacedFile);
    }

    return {
      success: true,
      result: updatedEntry,
    };
  } catch (error) {
    console.error("Error updating archive entry:", error);
    return { success: false, error: "Failed to update archive entry" };
  }
}

export async function deleteArchiveEntry(
  id: number,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession(ARCHIVE_ACCESS_ROLES);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const entry = await fetchArchiveEntry(id);
    if (!entry) {
      return { success: false, error: "Archive entry not found" };
    }

    const entriesToDelete = [entry];
    if (entry.entryType === ArchiveEntryType.FOLDER) {
      const descendants = await prisma.archiveEntry.findMany({
        where: {
          fullPath: {
            startsWith: `${entry.fullPath}/`,
          },
        },
        include: ARCHIVE_INCLUDE,
      });
      entriesToDelete.push(...descendants);
    }

    const fileReferences = entriesToDelete
      .map((item) =>
        item.file
          ? {
              id: item.file.id,
              key: item.file.key,
            }
          : null,
      )
      .filter((item): item is ArchiveFileReference => item != null);

    await prisma.$transaction(async (tx) => {
      await tx.archiveEntry.deleteMany({
        where: {
          id: {
            in: entriesToDelete.map((item) => item.id),
          },
        },
      });
    });

    for (const file of fileReferences) {
      await deleteFileIfUnreferenced(file);
    }

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting archive entry:", error);
    return { success: false, error: "Failed to delete archive entry" };
  }
}

export async function getRecentArchiveItems(
  limit = 5,
): Promise<ActionResult<ArchiveRecentItem[]>> {
  try {
    const sessionValidation = await validateSession(ARCHIVE_ACCESS_ROLES);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const normalizedLimit = Math.min(Math.max(Math.trunc(limit || 5), 1), 20);
    const items = await prisma.archiveEntry.findMany({
      take: normalizedLimit,
      orderBy: {
        updatedAt: "desc",
      },
      include: ARCHIVE_INCLUDE,
    });

    return {
      success: true,
      result: items.map((item) => ({
        id: item.id,
        name: item.name,
        entryType: item.entryType,
        parentPath: item.parentPath,
        mimeType: item.file?.mimeType ?? null,
        updatedAt: item.updatedAt ?? item.createdAt,
      })),
    };
  } catch (error) {
    console.error("Error fetching recent archive items:", error);
    return { success: false, error: "Failed to fetch recent archive items" };
  }
}
