import { getCriminalCaseNumberPreview } from "@/app/components/Case/Criminal/CriminalCasesActions";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const area = searchParams.get("area") ?? "";
  const yearValue = searchParams.get("year");
  const year = Number(yearValue);

  if (!yearValue || !Number.isFinite(year)) {
    return NextResponse.json(
      { success: false, error: "Valid area and year are required" },
      { status: 400 },
    );
  }

  const result = await getCriminalCaseNumberPreview(area, year);

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result, { status: 200 });
}
