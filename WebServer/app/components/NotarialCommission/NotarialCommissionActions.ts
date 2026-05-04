"use server";

import type { NotarialCommission } from "@rtc-database/shared/prisma/browser";
import { validateSession } from "@/app/lib/authActions";
import {
  deleteGarageFile,
  getFileHash,
  uploadFileToGarage,
} from "@/app/lib/garageActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import { ActionResult } from "@rtc-database/shared";
import {
  buildNotarialCommissionKey,
  extractCommissionYears,
  normalizePetitionNumber,
  type NotarialCommissionImageFile,
  type NotarialCommissionRecord,
  NotarialCommissionSchema,
} from "./schema";
import type { NotarialCommissionKeyFields } from "./schema";

const NOTARIAL_COMMISSION_ROLES = [Roles.ADMIN, Roles.NOTARIAL] as const;
const NOTARIAL_COMMISSION_IMAGE_BUCKET = "rtc-bucket";
const NOTARIAL_COMMISSION_IMAGE_ROOT = "NotarialCommision";

let notarialCommissionImageColumnEnsured = false;

type NotarialCommissionRowWithImage = {
  id: number;
  petition: string;
  name: string;
  termOfCommission: string;
  address: string;
  termStartYear: number | null;
  termEndYear: number | null;
  createdAt: Date | string;
  updatedAt: Date | string | null;
  imageFileId: number | null;
  imageFile_id: number | null;
  imageFile_key: string | null;
  imageFile_fileHash: string | null;
  imageFile_fileName: string | null;
  imageFile_path: string | null;
  imageFile_size: number | null;
  imageFile_mimeType: string | null;
  imageFile_createdAt: Date | string | null;
  imageFile_updatedAt: Date | string | null;
};

const normalizeImageSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildCommissionImageKey = (
  record: {
    name?: string;
    petition?: string;
    termStartYear?: number | null;
    termEndYear?: number | null;
  },
  fileHash: string,
): string => {
  const namePart = normalizeImageSegment(record.name || "commission");
  const petitionPart = normalizeImageSegment(record.petition || "");
  const yearPart = record.termStartYear ?? record.termEndYear ?? null;
  const yearLabel = yearPart ? String(yearPart) : "unknown-year";
  const hashPart = fileHash.slice(0, 12);
  const baseName = [namePart, petitionPart, yearLabel, hashPart]
    .filter(Boolean)
    .join("-");
  return `${NOTARIAL_COMMISSION_IMAGE_ROOT}/${baseName}`;
};

const normalizeCommissionData = (data: Record<string, unknown>) => {
  const parsedData = NotarialCommissionSchema.safeParse(data);
  if (!parsedData.success) {
    throw new Error(
      `Invalid notarial commission data: ${parsedData.error.message}`,
    );
  }

  const { termStartYear, termEndYear } = parsedData.data;
  const values = {
    petition: normalizePetitionNumber(parsedData.data.petition),
    name: parsedData.data.name,
    termOfCommission: parsedData.data.termOfCommission,
    address: parsedData.data.address,
  };
  const detectedYears = extractCommissionYears(values.termOfCommission);

  return {
    ...values,
    termStartYear: detectedYears.termStartYear ?? termStartYear ?? null,
    termEndYear: detectedYears.termEndYear ?? termEndYear ?? null,
    imageFile: parsedData.data.imageFile ?? null,
  };
};

const toDate = (value: Date | string): Date => new Date(value);

const toNullableDate = (value: Date | string | null): Date | null =>
  value ? new Date(value) : null;

const mapNotarialCommissionImageFile = (
  row: NotarialCommissionRowWithImage,
): NotarialCommissionImageFile | null => {
  if (!row.imageFile_id || !row.imageFile_key || !row.imageFile_fileName) {
    return null;
  }

  return {
    id: row.imageFile_id,
    key: row.imageFile_key,
    fileHash: row.imageFile_fileHash ?? "",
    fileName: row.imageFile_fileName,
    path: row.imageFile_path ?? "",
    size: row.imageFile_size ?? 0,
    mimeType: row.imageFile_mimeType ?? "",
    createdAt: toDate(row.imageFile_createdAt ?? new Date()),
    updatedAt: toNullableDate(row.imageFile_updatedAt),
  };
};

const mapNotarialCommissionRow = (
  row: NotarialCommissionRowWithImage,
): NotarialCommissionRecord => ({
  id: row.id,
  petition: row.petition,
  name: row.name,
  termOfCommission: row.termOfCommission,
  address: row.address,
  termStartYear: row.termStartYear,
  termEndYear: row.termEndYear,
  createdAt: toDate(row.createdAt),
  updatedAt: toNullableDate(row.updatedAt),
  imageFileId: row.imageFileId,
  imageFile: mapNotarialCommissionImageFile(row),
});

async function ensureNotarialCommissionImageColumn(): Promise<void> {
  if (notarialCommissionImageColumnEnsured) {
    return;
  }

  const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `PRAGMA table_info("NotarialCommission")`,
  );

  if (!columns.some((column) => column.name === "imageFileId")) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "NotarialCommission" ADD COLUMN "imageFileId" INTEGER`,
    );
  }

  notarialCommissionImageColumnEnsured = true;
}

async function queryNotarialCommissionRecords(
  whereClause = "",
  params: unknown[] = [],
): Promise<NotarialCommissionRecord[]> {
  await ensureNotarialCommissionImageColumn();

  const rows = await prisma.$queryRawUnsafe<NotarialCommissionRowWithImage[]>(
    `
      SELECT
        n."id" AS id,
        n."petition" AS petition,
        n."name" AS name,
        n."termOfCommission" AS termOfCommission,
        n."address" AS address,
        n."termStartYear" AS termStartYear,
        n."termEndYear" AS termEndYear,
        n."createdAt" AS createdAt,
        n."updatedAt" AS updatedAt,
        n."imageFileId" AS imageFileId,
        f."id" AS imageFile_id,
        f."key" AS imageFile_key,
        f."fileHash" AS imageFile_fileHash,
        f."fileName" AS imageFile_fileName,
        f."path" AS imageFile_path,
        f."size" AS imageFile_size,
        f."mimeType" AS imageFile_mimeType,
        f."createdAt" AS imageFile_createdAt,
        f."updatedAt" AS imageFile_updatedAt
      FROM "NotarialCommission" n
      LEFT JOIN "FileData" f ON f."id" = n."imageFileId"
      ${whereClause}
    `,
    ...params,
  );

  return rows.map(mapNotarialCommissionRow);
}

async function countNotarialCommissionByImageFileId(
  imageFileId: number,
): Promise<number> {
  await ensureNotarialCommissionImageColumn();

  const rows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*) AS count FROM "NotarialCommission" WHERE "imageFileId" = ?`,
    imageFileId,
  );

  return Number(rows[0]?.count ?? 0);
}

export async function doesNotarialCommissionExist(
  records: NotarialCommissionKeyFields[],
): Promise<ActionResult<string[]>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_COMMISSION_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const normalizedRecords = records
      .map((record) => ({
        petition: normalizePetitionNumber(record.petition),
        name: String(record.name ?? "").trim(),
        termOfCommission: String(record.termOfCommission ?? "").trim(),
        address: String(record.address ?? "").trim(),
      }))
      .filter(
        (record) =>
          record.name.length > 0 &&
          record.termOfCommission.length > 0 &&
          record.address.length > 0,
      );

    if (normalizedRecords.length === 0) {
      return { success: true, result: [] };
    }

    const existingRecords = await prisma.notarialCommission.findMany({
      where: {
        OR: normalizedRecords.map((record) => ({
          petition: record.petition,
          name: record.name,
          termOfCommission: record.termOfCommission,
          address: record.address,
        })),
      },
      select: {
        petition: true,
        name: true,
        termOfCommission: true,
        address: true,
      },
    });

    return {
      success: true,
      result: existingRecords.map(buildNotarialCommissionKey),
    };
  } catch (error) {
    console.error("Error checking notarial commission existence:", error);
    return {
      success: false,
      error: "Error checking notarial commission existence",
    };
  }
}

export async function getNotarialCommissions(): Promise<
  ActionResult<NotarialCommissionRecord[]>
> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_COMMISSION_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const records = await queryNotarialCommissionRecords(
      `ORDER BY n."termStartYear" DESC, n."id" DESC`,
    );

    return { success: true, result: records };
  } catch (error) {
    console.error("Error fetching notarial commissions:", error);
    return { success: false, error: "Error fetching notarial commissions" };
  }
}

export async function getNotarialCommissionById(
  id: number,
): Promise<ActionResult<NotarialCommissionRecord>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_COMMISSION_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const record = (await queryNotarialCommissionRecords(`WHERE n."id" = ?`, [
      id,
    ]))[0];

    if (!record) {
      return { success: false, error: "Notarial commission not found" };
    }

    return { success: true, result: record };
  } catch (error) {
    console.error("Error fetching notarial commission by id:", error);
    return { success: false, error: "Error fetching notarial commission" };
  }
}

export async function getNotarialCommissionsByIds(
  ids: Array<number | string>,
): Promise<ActionResult<NotarialCommissionRecord[]>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_COMMISSION_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const validIds = ids
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (validIds.length === 0) {
      return { success: false, error: "No valid record IDs provided" };
    }

    const placeholders = validIds.map(() => "?").join(", ");
    const records = await queryNotarialCommissionRecords(
      `WHERE n."id" IN (${placeholders})`,
      validIds,
    );

    const orderMap = new Map(validIds.map((id, index) => [id, index]));
    records.sort(
      (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
    );

    if (records.length !== validIds.length) {
      return { success: false, error: "One or more records were not found" };
    }

    return { success: true, result: records };
  } catch (error) {
    console.error("Error fetching notarial commissions by ids:", error);
    return { success: false, error: "Error fetching notarial commissions" };
  }
}

export async function createNotarialCommission(
  data: Record<string, unknown>,
): Promise<ActionResult<NotarialCommissionRecord>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_COMMISSION_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const { imageFile, ...recordData } = normalizeCommissionData(data);
    let imageFileId: number | undefined;

    if (imageFile) {
      const fileHash = await getFileHash(imageFile);
      const key = buildCommissionImageKey(recordData, fileHash);
      const uploadResult = await uploadFileToGarage(
        imageFile,
        key,
        "",
        NOTARIAL_COMMISSION_IMAGE_BUCKET,
      );

      if (!uploadResult.success) {
        return {
          success: false,
          error:
            "Notarial commission image upload failed: " + uploadResult.error,
        };
      }

      imageFileId = uploadResult.result.id;
    }

    const record = await prisma.notarialCommission.create({
      data: recordData,
    });

    if (imageFileId) {
      await ensureNotarialCommissionImageColumn();
      await prisma.$executeRawUnsafe(
        `UPDATE "NotarialCommission" SET "imageFileId" = ? WHERE "id" = ?`,
        imageFileId,
        record.id,
      );
    }

    const createdRecord = (
      await queryNotarialCommissionRecords(`WHERE n."id" = ?`, [record.id])
    )[0];

    if (!createdRecord) {
      return {
        success: false,
        error: "Notarial commission created but failed to reload",
      };
    }

    return { success: true, result: createdRecord };
  } catch (error) {
    console.error("Error creating notarial commission:", error);
    return { success: false, error: "Error creating notarial commission" };
  }
}

export async function updateNotarialCommission(
  id: number,
  data: Record<string, unknown>,
): Promise<ActionResult<NotarialCommissionRecord>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_COMMISSION_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const existing = (await queryNotarialCommissionRecords(`WHERE n."id" = ?`, [
      id,
    ]))[0];

    if (!existing) {
      return { success: false, error: "Notarial commission not found" };
    }

    const { imageFile, ...recordData } = normalizeCommissionData(data);
    let imageFileId: number | undefined;

    if (imageFile) {
      const fileHash = await getFileHash(imageFile);
      const key = buildCommissionImageKey(recordData, fileHash);
      const uploadResult = await uploadFileToGarage(
        imageFile,
        key,
        "",
        NOTARIAL_COMMISSION_IMAGE_BUCKET,
      );

      if (!uploadResult.success) {
        return {
          success: false,
          error:
            "Notarial commission image upload failed: " + uploadResult.error,
        };
      }

      imageFileId = uploadResult.result.id;
    }

    await prisma.notarialCommission.update({
      where: { id },
      data: recordData,
    });

    if (imageFileId) {
      await ensureNotarialCommissionImageColumn();
      await prisma.$executeRawUnsafe(
        `UPDATE "NotarialCommission" SET "imageFileId" = ? WHERE "id" = ?`,
        imageFileId,
        id,
      );
    }

    const reloadedRecord = (
      await queryNotarialCommissionRecords(`WHERE n."id" = ?`, [id])
    )[0];

    if (
      imageFileId &&
      existing.imageFileId &&
      existing.imageFileId !== imageFileId &&
      existing.imageFile?.key
    ) {
      const remaining = await countNotarialCommissionByImageFileId(
        existing.imageFileId,
      );
      if (remaining === 0) {
        await deleteGarageFile(
          existing.imageFile.key,
          NOTARIAL_COMMISSION_IMAGE_BUCKET,
        );
      }
    }

    if (!reloadedRecord) {
      return {
        success: false,
        error: "Notarial commission updated but failed to reload",
      };
    }

    return { success: true, result: reloadedRecord };
  } catch (error) {
    console.error("Error updating notarial commission:", error);
    return { success: false, error: "Error updating notarial commission" };
  }
}

export async function deleteNotarialCommission(
  id: number,
): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession([...NOTARIAL_COMMISSION_ROLES]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const existing = (await queryNotarialCommissionRecords(`WHERE n."id" = ?`, [
      id,
    ]))[0];

    if (!existing) {
      return { success: false, error: "Notarial commission not found" };
    }

    await prisma.notarialCommission.delete({ where: { id } });

    if (existing.imageFileId && existing.imageFile?.key) {
      const remaining = await countNotarialCommissionByImageFileId(
        existing.imageFileId,
      );
      if (remaining === 0) {
        await deleteGarageFile(
          existing.imageFile.key,
          NOTARIAL_COMMISSION_IMAGE_BUCKET,
        );
      }
    }

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting notarial commission:", error);
    return { success: false, error: "Error deleting notarial commission" };
  }
}
