"use server";

import { PaginatedResult } from "@/app/components/Filter/FilterTypes";
import { FilterOptions } from "@/app/components/Filter/FilterUtils";
import { Prisma } from "@/app/generated/prisma/client";
import { validateSession } from "@/app/lib/authActions";
import {
  deleteGarageFile,
  moveGarageFile,
  uploadFileToGarage,
} from "@/app/lib/garageActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import { createHash } from "crypto";
import { prettifyError } from "zod";
import ActionResult from "../../ActionResult";
import { generateFileKey, NotarialData, NotarialSchema } from "./schema";

type NotarialListFilterShape = {
  title?: string | null;
  name?: string | null;
  atty?: string | null;
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
};

function buildNotarialWhere(
  options?: NotarialFilterOptions,
): Prisma.NotarialWhereInput {
  const filters = options?.filters;
  const exactMatchMap = options?.exactMatchMap ?? {};
  const conditions: Prisma.NotarialWhereInput[] = [];

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

  return conditions.length > 0 ? { AND: conditions } : {};
}

async function getFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return createHash("sha256").update(Buffer.from(buffer)).digest("hex");
}

async function deleteFileIfUnreferenced(fileId: number, key: string) {
  const remainingReferences = await prisma.notarial.count({
    where: { fileId },
  });

  if (remainingReferences === 0) {
    await deleteGarageFile(key);
  }
}

export async function getNotarial(): Promise<ActionResult<NotarialData[]>> {
  try {
    const sessionResult = await validateSession();
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

export async function getNotarialPage(
  options?: NotarialFilterOptions,
): Promise<ActionResult<PaginatedResult<NotarialData>>> {
  try {
    const sessionResult = await validateSession();
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
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const where = buildNotarialWhere(options);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [totalRecords, thisMonth, noDate, attorneys] =
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
      ]);

    return {
      success: true,
      result: {
        totalRecords,
        thisMonth,
        uniqueAttorneys: attorneys.filter((a) => !!a.attorney).length,
        noDate,
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
    const sessionResult = await validateSession([Roles.ADMIN, Roles.ATTY]);
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
      path: _path,
      removeFile: _removeFile,
      ...notarialFields
    } = parsedData.data;

    let uploadResult;
    try {
      const fileHash = await getFileHash(file);
      uploadResult = await uploadFileToGarage(
        file,
        generateFileKey({ ...parsedData.data, fileHash }),
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
    const sessionResult = await validateSession([Roles.ADMIN, Roles.ATTY]);
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
      const uploadKey = generateFileKey({
        ...mergedData,
        fileHash: incomingFileHash,
      });
      if (!uploadKey) {
        return {
          success: false,
          error: "Notarial updated but generated file key is empty.",
        };
      }

      const updatedFile = await uploadFileToGarage(incomingFile, uploadKey);

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
      if (nextKey && nextKey !== existingNotarial.file.key) {
        await moveGarageFile(existingNotarial.file.key, nextKey);
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
    const sessionResult = await validateSession([Roles.ADMIN, Roles.ATTY]);
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
