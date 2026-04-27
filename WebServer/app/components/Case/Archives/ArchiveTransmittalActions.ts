"use server";

import { validateSession } from "@/app/lib/authActions";
import { getGarageFileUrl } from "@/app/lib/garageActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import {
  ActionResult,
  ArchiveEntryData,
  ArchiveEntryType,
  ArchiveFilterOptions,
  ArchiveStats,
  PaginatedResult,
} from "@rtc-database/shared";
import { Prisma } from "@rtc-database/shared/prisma/client";

const ARCHIVE_ACCESS_ROLES = [Roles.ARCHIVE, Roles.ADMIN, Roles.ATTY];
const ARCHIVE_INCLUDE = {
  file: true,
} satisfies Prisma.ArchiveEntryTransmittalInclude;

const normalizeNullableString = (value?: string | null): string | null => {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
};

const buildArchiveWhere = (
  options?: ArchiveFilterOptions,
): Prisma.ArchiveEntryTransmittalWhereInput => {
  const filters = options?.filters;
  const searchValue = normalizeNullableString(filters?.search);
  const parentPath = filters?.parentPath;
  const conditions: Prisma.ArchiveEntryTransmittalWhereInput[] = [];

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
      parentPath,
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
): Prisma.ArchiveEntryTransmittalOrderByWithRelationInput[] => {
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
  prisma.archiveEntryTransmittal.findUnique({
    where: { id },
    include: ARCHIVE_INCLUDE,
  });

export async function getArchiveTransmittalEntriesPage(
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
      prisma.archiveEntryTransmittal.findMany({
        where,
        include: ARCHIVE_INCLUDE,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.archiveEntryTransmittal.count({ where }),
    ]);

    return {
      success: true,
      result: {
        items: items as ArchiveEntryData[],
        total,
      },
    };
  } catch (error) {
    console.error("Error fetching archive transmittals:", error);
    return { success: false, error: "Failed to fetch archive transmittals" };
  }
}

export async function getArchiveTransmittalStats(
  options?: ArchiveFilterOptions,
): Promise<ActionResult<ArchiveStats>> {
  try {
    const sessionValidation = await validateSession(ARCHIVE_ACCESS_ROLES);
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const where = buildArchiveWhere(options);

    const [totalItems, folders, editableItems, uploadedFiles] =
      await prisma.$transaction([
        prisma.archiveEntryTransmittal.count({ where }),
        prisma.archiveEntryTransmittal.count({
          where: {
            AND: [where, { entryType: ArchiveEntryType.FOLDER }],
          },
        }),
        prisma.archiveEntryTransmittal.count({
          where: {
            AND: [
              where,
              {
                entryType: {
                  in: [
                    ArchiveEntryType.DOCUMENT,
                    ArchiveEntryType.SPREADSHEET,
                  ],
                },
              },
            ],
          },
        }),
        prisma.archiveEntryTransmittal.count({
          where: {
            AND: [where, { entryType: ArchiveEntryType.FILE }],
          },
        }),
      ]);

    return {
      success: true,
      result: {
        totalItems,
        folders,
        editableItems,
        uploadedFiles,
      },
    };
  } catch (error) {
    console.error("Error fetching archive transmittal stats:", error);
    return {
      success: false,
      error: "Failed to fetch archive transmittal stats",
    };
  }
}

export async function getArchiveTransmittalFileUrl(
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
      return { success: false, error: "Archive transmittal entry not found" };
    }

    if (!entry.file) {
      return { success: false, error: "No file stored for this archive entry" };
    }

    return await getGarageFileUrl(entry.file.key, {
      inline: options?.inline,
      fileName: options?.fileName || entry.name || entry.file.fileName,
      contentType: options?.contentType || entry.file.mimeType,
    });
  } catch (error) {
    console.error("Error getting archive transmittal file URL:", error);
    return {
      success: false,
      error: "Failed to get archive transmittal file URL",
    };
  }
}
