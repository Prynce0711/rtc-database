import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const sessionResult = await validateSession(Roles.ADMIN);
    if (!sessionResult.success) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "1000");
    const offset = parseInt(searchParams.get("offset") || "0");

    const logs = await prisma.activityLog.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip: offset,
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity logs" },
      { status: 500 }
    );
  }
}
