import { getCriminalCasesByIds } from "@/app/components/Case/Criminal/CriminalCasesActions";
import { NextResponse } from "next/server";

type ByIdsPayload = {
  ids?: Array<string | number>;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ByIdsPayload;
    const ids = Array.isArray(body.ids) ? body.ids : undefined;

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "ids array is required" },
        { status: 400 },
      );
    }

    const result = await getCriminalCasesByIds(ids);
    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }
}
