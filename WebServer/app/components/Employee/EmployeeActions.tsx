"use server";

import { Employee, LogAction } from "@/app/generated/prisma/browser";
import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import ActionResult from "../ActionResult";
import { createLog } from "../ActivityLogs/LogActions";
import { EmployeeSchema } from "./schema";

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
      .map((e) => e.employeeNumber)
      .filter((employeeNumber): employeeNumber is string => !!employeeNumber);
    return { success: true, result: existingEmployeeNumbers };
  } catch (error) {
    console.error("Error checking employee existence:", error);
    return { success: false, error: "Error checking employee existence" };
  }
}

export async function getEmployees(): Promise<ActionResult<Employee[]>> {
  try {
    const sessionResult = await validateSession([Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const employees = await prisma.employee.findMany();
    return { success: true, result: employees };
  } catch (error) {
    console.error("Error fetching employees:", error);
    return { success: false, error: "Error fetching employees" };
  }
}

export async function getEmployeeById(
  employeeId: number,
): Promise<ActionResult<Employee>> {
  try {
    const sessionResult = await validateSession([Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

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
): Promise<ActionResult<Employee[]>> {
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

    const employees = await prisma.employee.findMany({
      where: { id: { in: validIds } },
    });

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
): Promise<ActionResult<Employee>> {
  try {
    const sessionResult = await validateSession([Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const employeeData = EmployeeSchema.safeParse(data);
    if (!employeeData.success) {
      throw new Error(`Invalid employee data: ${employeeData.error.message}`);
    }

    const newEmployee = await prisma.employee.create({
      data: employeeData.data,
    });

    await createLog({
      action: LogAction.CREATE_EMPLOYEE,
      details: {
        id: newEmployee.id,
      },
    });

    return { success: true, result: newEmployee };
  } catch (error) {
    console.error("Error creating employee:", error);
    return { success: false, error: "Error creating employee" };
  }
}

export async function updateEmployee(
  employeeId: number,
  data: Record<string, unknown>,
): Promise<ActionResult<Employee>> {
  try {
    const sessionResult = await validateSession([Roles.ADMIN]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const employeeData = EmployeeSchema.safeParse(data);
    if (!employeeData.success) {
      throw new Error(`Invalid employee data: ${employeeData.error.message}`);
    }

    const oldEmployee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!oldEmployee) {
      throw new Error("Employee not found");
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id: employeeId },
      data: employeeData.data,
    });

    await createLog({
      action: LogAction.UPDATE_EMPLOYEE,
      details: {
        from: oldEmployee,
        to: updatedEmployee,
      },
    });

    return { success: true, result: updatedEmployee };
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

    const employeeToDelete = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employeeToDelete) {
      throw new Error("Employee not found");
    }

    await prisma.employee.delete({
      where: { id: employeeId },
    });

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
