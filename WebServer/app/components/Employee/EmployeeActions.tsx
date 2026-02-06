"use server";

import { Employee } from "@/app/generated/prisma/browser";
import { Role, validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import ActionResult from "../ActionResult";
import { EmployeeSchema } from "./schema";

export async function getEmployees(): Promise<ActionResult<Employee[]>> {
  try {
    const sessionResult = await validateSession(Role.ADMIN);
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

export async function createEmployee(
  data: Record<string, unknown>,
): Promise<ActionResult<Employee>> {
  try {
    const sessionResult = await validateSession(Role.ADMIN);
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
    const sessionResult = await validateSession(Role.ADMIN);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const employeeData = EmployeeSchema.safeParse(data);
    if (!employeeData.success) {
      throw new Error(`Invalid employee data: ${employeeData.error.message}`);
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id: employeeId },
      data: employeeData.data,
    });
    return { success: true, result: updatedEmployee };
  } catch (error) {
    console.error("Error updating employee:", error);
    return { success: false, error: "Error updating employee" };
  }
}

export async function deleteEmployee(
  employeeNumber: string,
): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession(Role.ADMIN);
    if (!sessionResult.success) {
      return sessionResult;
    }

    await prisma.employee.delete({
      where: { employeeNumber },
    });
    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting employee:", error);
    return { success: false, error: "Error deleting employee" };
  }
}
