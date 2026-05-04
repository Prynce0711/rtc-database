"use server";

import { Employee, LogAction } from "@rtc-database/shared/prisma/browser";
import { validateSession } from "@/app/lib/authActions";
import {
  deleteGarageFile,
  getFileHash,
  uploadFileToGarage,
} from "@/app/lib/garageActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import { ActionResult } from "@rtc-database/shared";
import { createLog } from "../ActivityLogs/LogActions";
import { EmployeeImageFile, EmployeeRecord, EmployeeSchema } from "./schema";

const EMPLOYEE_IMAGE_BUCKET = "rtc-bucket";
const EMPLOYEE_IMAGE_ROOT = "Employee";

let employeeImageColumnEnsured = false;

type EmployeeRowWithImage = {
  id: number;
  employeeName: string;
  employeeNumber: string | null;
  position: string;
  branch: string;
  birthDate: Date | string;
  dateHired: Date | string;
  employmentType: Employee["employmentType"];
  contactNumber: string | null;
  email: string | null;
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

const buildEmployeeImageKey = (
  employee: { employeeName?: string; employeeNumber?: string | null },
  fileHash: string,
): string => {
  const namePart = normalizeImageSegment(employee.employeeName || "employee");
  const numberPart = normalizeImageSegment(employee.employeeNumber || "");
  const hashPart = fileHash.slice(0, 12);
  const baseName = [namePart, numberPart, hashPart].filter(Boolean).join("-");
  return `${EMPLOYEE_IMAGE_ROOT}/${baseName}`;
};

const toDate = (value: Date | string): Date => new Date(value);

const toNullableDate = (value: Date | string | null): Date | null =>
  value ? new Date(value) : null;

const mapEmployeeImageFile = (
  row: EmployeeRowWithImage,
): EmployeeImageFile | null => {
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

const mapEmployeeRow = (row: EmployeeRowWithImage): EmployeeRecord => ({
  id: row.id,
  employeeName: row.employeeName,
  employeeNumber: row.employeeNumber,
  position: row.position,
  branch: row.branch,
  birthDate: toDate(row.birthDate),
  dateHired: toDate(row.dateHired),
  employmentType: row.employmentType,
  contactNumber: row.contactNumber,
  email: row.email,
  createdAt: toDate(row.createdAt),
  updatedAt: toNullableDate(row.updatedAt),
  imageFileId: row.imageFileId,
  imageFile: mapEmployeeImageFile(row),
});

const toEmployeeLogPayload = (employee: EmployeeRecord) => ({
  id: employee.id,
  employeeName: employee.employeeName,
  employeeNumber: employee.employeeNumber,
  position: employee.position,
  branch: employee.branch,
  birthDate: employee.birthDate,
  dateHired: employee.dateHired,
  employmentType: employee.employmentType,
  contactNumber: employee.contactNumber,
  email: employee.email,
});

async function ensureEmployeeImageColumn(): Promise<void> {
  if (employeeImageColumnEnsured) {
    return;
  }

  const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `PRAGMA table_info("Employee")`,
  );

  if (!columns.some((column) => column.name === "imageFileId")) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Employee" ADD COLUMN "imageFileId" INTEGER`,
    );
  }

  employeeImageColumnEnsured = true;
}

async function queryEmployeeRecords(
  whereClause = "",
  params: unknown[] = [],
): Promise<EmployeeRecord[]> {
  await ensureEmployeeImageColumn();

  const rows = await prisma.$queryRawUnsafe<EmployeeRowWithImage[]>(
    `
      SELECT
        e."id" AS id,
        e."employeeName" AS employeeName,
        e."employeeNumber" AS employeeNumber,
        e."position" AS position,
        e."branch" AS branch,
        e."birthDate" AS birthDate,
        e."dateHired" AS dateHired,
        e."employmentType" AS employmentType,
        e."contactNumber" AS contactNumber,
        e."email" AS email,
        e."createdAt" AS createdAt,
        e."updatedAt" AS updatedAt,
        e."imageFileId" AS imageFileId,
        f."id" AS imageFile_id,
        f."key" AS imageFile_key,
        f."fileHash" AS imageFile_fileHash,
        f."fileName" AS imageFile_fileName,
        f."path" AS imageFile_path,
        f."size" AS imageFile_size,
        f."mimeType" AS imageFile_mimeType,
        f."createdAt" AS imageFile_createdAt,
        f."updatedAt" AS imageFile_updatedAt
      FROM "Employee" e
      LEFT JOIN "FileData" f ON f."id" = e."imageFileId"
      ${whereClause}
    `,
    ...params,
  );

  return rows.map(mapEmployeeRow);
}

async function countEmployeesByImageFileId(imageFileId: number): Promise<number> {
  await ensureEmployeeImageColumn();

  const rows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*) AS count FROM "Employee" WHERE "imageFileId" = ?`,
    imageFileId,
  );

  return Number(rows[0]?.count ?? 0);
}

export async function doesEmployeeExist(
  employeeNumbers: Array<string | null | undefined>,
): Promise<ActionResult<string[]>> {
  try {
    const sessionResult = await validateSession([Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const validEmployeeNumbers = employeeNumbers
      .filter(
        (employeeNumber): employeeNumber is string =>
          typeof employeeNumber === "string" &&
          employeeNumber.trim().length > 0,
      )
      .map((employeeNumber) => employeeNumber.trim());

    if (validEmployeeNumbers.length === 0) {
      return { success: true, result: [] };
    }

    const employees = await prisma.employee.findMany({
      where: {
        employeeNumber: { in: validEmployeeNumbers },
      },
      select: {
        employeeNumber: true,
      },
    });

    const existingEmployeeNumbers = employees
      .map((employee) => employee.employeeNumber)
      .filter((employeeNumber): employeeNumber is string => !!employeeNumber);

    return { success: true, result: existingEmployeeNumbers };
  } catch (error) {
    console.error("Error checking employee existence:", error);
    return { success: false, error: "Error checking employee existence" };
  }
}

export async function getEmployees(): Promise<ActionResult<EmployeeRecord[]>> {
  try {
    const sessionResult = await validateSession([Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const employees = await queryEmployeeRecords(`ORDER BY e."employeeName" ASC`);
    return { success: true, result: employees };
  } catch (error) {
    console.error("Error fetching employees:", error);
    return { success: false, error: "Error fetching employees" };
  }
}

export async function getEmployeeById(
  employeeId: number,
): Promise<ActionResult<EmployeeRecord>> {
  try {
    const sessionResult = await validateSession([Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const employee = (await queryEmployeeRecords(`WHERE e."id" = ?`, [
      employeeId,
    ]))[0];

    if (!employee) {
      return { success: false, error: "Employee not found" };
    }

    return { success: true, result: employee };
  } catch (error) {
    console.error("Error fetching employee by id:", error);
    return { success: false, error: "Error fetching employee" };
  }
}

export async function getEmployeesByIds(
  ids: Array<number | string>,
): Promise<ActionResult<EmployeeRecord[]>> {
  try {
    const sessionResult = await validateSession([Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const validIds = ids
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (validIds.length === 0) {
      return { success: false, error: "No valid employee IDs provided" };
    }

    const placeholders = validIds.map(() => "?").join(", ");
    const employees = await queryEmployeeRecords(
      `WHERE e."id" IN (${placeholders})`,
      validIds,
    );

    const orderMap = new Map(validIds.map((id, index) => [id, index]));
    employees.sort(
      (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
    );

    if (employees.length !== validIds.length) {
      return { success: false, error: "One or more employees were not found" };
    }

    return { success: true, result: employees };
  } catch (error) {
    console.error("Error fetching employees by ids:", error);
    return { success: false, error: "Error fetching employees" };
  }
}

export async function createEmployee(
  data: Record<string, unknown>,
): Promise<ActionResult<EmployeeRecord>> {
  try {
    const sessionResult = await validateSession([Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const employeeData = EmployeeSchema.safeParse(data);
    if (!employeeData.success) {
      throw new Error(`Invalid employee data: ${employeeData.error.message}`);
    }

    const { imageFile, ...employeeFields } = employeeData.data;
    let imageFileId: number | undefined;

    if (imageFile) {
      const fileHash = await getFileHash(imageFile);
      const key = buildEmployeeImageKey(employeeFields, fileHash);
      const uploadResult = await uploadFileToGarage(
        imageFile,
        key,
        "",
        EMPLOYEE_IMAGE_BUCKET,
      );

      if (!uploadResult.success) {
        return {
          success: false,
          error: "Employee image upload failed: " + uploadResult.error,
        };
      }

      imageFileId = uploadResult.result.id;
    }

    const newEmployee = await prisma.employee.create({
      data: employeeFields,
    });

    if (imageFileId) {
      await ensureEmployeeImageColumn();
      await prisma.$executeRawUnsafe(
        `UPDATE "Employee" SET "imageFileId" = ? WHERE "id" = ?`,
        imageFileId,
        newEmployee.id,
      );
    }

    const createdEmployee = (await queryEmployeeRecords(`WHERE e."id" = ?`, [
      newEmployee.id,
    ]))[0];

    await createLog({
      action: LogAction.CREATE_EMPLOYEE,
      details: {
        id: newEmployee.id,
      },
    });

    if (!createdEmployee) {
      return { success: false, error: "Employee created but failed to reload" };
    }

    return { success: true, result: createdEmployee };
  } catch (error) {
    console.error("Error creating employee:", error);
    return { success: false, error: "Error creating employee" };
  }
}

export async function updateEmployee(
  employeeId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<EmployeeRecord>> {
  try {
    const sessionResult = await validateSession([Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const employeeData = EmployeeSchema.safeParse(data);
    if (!employeeData.success) {
      throw new Error(`Invalid employee data: ${employeeData.error.message}`);
    }

    const oldEmployee = (await queryEmployeeRecords(`WHERE e."id" = ?`, [
      employeeId,
    ]))[0];

    if (!oldEmployee) {
      throw new Error("Employee not found");
    }

    const { imageFile, ...employeeFields } = employeeData.data;
    let imageFileId: number | undefined;

    if (imageFile) {
      const fileHash = await getFileHash(imageFile);
      const key = buildEmployeeImageKey(employeeFields, fileHash);
      const uploadResult = await uploadFileToGarage(
        imageFile,
        key,
        "",
        EMPLOYEE_IMAGE_BUCKET,
      );

      if (!uploadResult.success) {
        return {
          success: false,
          error: "Employee image upload failed: " + uploadResult.error,
        };
      }

      imageFileId = uploadResult.result.id;
    }

    await prisma.employee.update({
      where: { id: employeeId },
      data: employeeFields,
    });

    if (imageFileId) {
      await ensureEmployeeImageColumn();
      await prisma.$executeRawUnsafe(
        `UPDATE "Employee" SET "imageFileId" = ? WHERE "id" = ?`,
        imageFileId,
        employeeId,
      );
    }

    const reloadedEmployee = (await queryEmployeeRecords(`WHERE e."id" = ?`, [
      employeeId,
    ]))[0];

    if (
      imageFileId &&
      oldEmployee.imageFileId &&
      oldEmployee.imageFileId !== imageFileId &&
      oldEmployee.imageFile?.key
    ) {
      const remaining = await countEmployeesByImageFileId(oldEmployee.imageFileId);
      if (remaining === 0) {
        await deleteGarageFile(
          oldEmployee.imageFile.key,
          EMPLOYEE_IMAGE_BUCKET,
        );
      }
    }

    if (!reloadedEmployee) {
      return { success: false, error: "Employee updated but failed to reload" };
    }

    await createLog({
      action: LogAction.UPDATE_EMPLOYEE,
      details: {
        from: toEmployeeLogPayload(oldEmployee),
        to: toEmployeeLogPayload(reloadedEmployee),
      },
    });

    return { success: true, result: reloadedEmployee };
  } catch (error) {
    console.error("Error updating employee:", error);
    return { success: false, error: "Error updating employee" };
  }
}

export async function deleteEmployee(
  employeeId: number,
): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession([Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    if (!employeeId) {
      throw new Error("Employee ID is required for deletion");
    }

    const employeeToDelete = (await queryEmployeeRecords(`WHERE e."id" = ?`, [
      employeeId,
    ]))[0];

    if (!employeeToDelete) {
      throw new Error("Employee not found");
    }

    await prisma.employee.delete({
      where: { id: employeeId },
    });

    if (employeeToDelete.imageFileId && employeeToDelete.imageFile?.key) {
      const remaining = await countEmployeesByImageFileId(
        employeeToDelete.imageFileId,
      );
      if (remaining === 0) {
        await deleteGarageFile(
          employeeToDelete.imageFile.key,
          EMPLOYEE_IMAGE_BUCKET,
        );
      }
    }

    await createLog({
      action: LogAction.DELETE_EMPLOYEE,
      details: {
        id: employeeId,
      },
    });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting employee:", error);
    return { success: false, error: "Error deleting employee" };
  }
}
