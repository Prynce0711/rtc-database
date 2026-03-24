"use server";

import { CaseType } from "@/app/generated/prisma/enums";
import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import ActionResult from "../ActionResult";

export async function doesCaseExist(
  caseNumbers: string[],
  caseType: CaseType,
): Promise<ActionResult<string[]>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const cases = await prisma.case.findMany({
      where: {
        caseNumber: { in: caseNumbers },
        caseType,
      },
      select: {
        caseNumber: true,
      },
    });

    const existingCaseNumbers = cases.map((c) => c.caseNumber);
    return { success: true, result: existingCaseNumbers };
  } catch (error) {
    console.error("Error fetching cases:", error);
    return { success: false, error: "Error fetching cases" };
  }
}
