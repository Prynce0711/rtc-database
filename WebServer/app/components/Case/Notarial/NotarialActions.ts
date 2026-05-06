"use server";

import { validateSession } from "@/app/lib/authActions";
import { GetFileOptions } from "@/app/lib/garage";
import {
  deleteGarageFile,
  deleteGarageKeys,
  getFileHash,
  getGarageFileUrl,
  listGarageFolder,
  moveGarageKeys,
  moveGarageFile,
  renameGarageKey,
  uploadFileToGarage,
  createGarageFolderMarker,
  GARAGE_NOTARIAL_ROOT,
  type GarageItem,
} from "@/app/lib/garageActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import {
  ActionResult,
  FilterOptions,
  PaginatedResult,
} from "@rtc-database/shared";
import { Prisma } from "@rtc-database/shared/prisma/client";
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

    const {
      file,
      path,
      removeFile,
      ...notarialFields
    } = parsedData.data;
    void removeFile;

    if (!file) {
      throw new Error("File is required for creating notarial data");
    }

    let uploadResult;
    try {
      const fileHash = await getFileHash(file);
      const targetFolder = normalizeGaragePath(path);
      const uploadKey = path != null
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
      const uploadKey = parsedData.data.path != null
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
    const fileKeyConditions: Prisma.FileDataWhereInput[] = [];
    const exactStorageKeys: string[] = [];

    for (const key of normalizedKeys) {
      const isFolder = key.endsWith("/");
      const normalizedKey = normalizeGaragePath(key);
      if (!normalizedKey) continue;

      const scopedKey = scopeNotarialStorageKey(normalizedKey);
      if (isFolder) {
        fileKeyConditions.push({
          key: {
            startsWith: `${scopedKey}/`,
          },
        });
      } else {
        exactStorageKeys.push(scopedKey);
      }
    }

    if (exactStorageKeys.length > 0) {
      fileKeyConditions.push({
        key: {
          in: exactStorageKeys,
        },
      });
    }

    const notarialRowsToDelete =
      fileKeyConditions.length > 0
        ? await prisma.notarial.findMany({
            where: {
              file: {
                is: {
                  OR: fileKeyConditions,
                },
              },
            },
            select: {
              id: true,
            },
          })
        : [];

    const result = await deleteGarageKeys(
      normalizedKeys,
      NOTARIAL_GARAGE_BUCKET,
      NOTARIAL_GARAGE_ROOT,
    );
    if (!result.success) {
      return { success: false, error: result.error };
    }

    if (notarialRowsToDelete.length > 0) {
      await prisma.notarial.deleteMany({
        where: {
          id: {
            in: notarialRowsToDelete.map((row) => row.id),
          },
        },
      });
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
        (item) => item.isDirectory && item.name.toLowerCase() === name.toLowerCase(),
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

