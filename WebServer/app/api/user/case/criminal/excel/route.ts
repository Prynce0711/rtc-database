import {
  exportCasesExcel,
  uploadExcel,
} from "@/app/components/Case/Criminal/ExcelActions";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const result = await exportCasesExcel();

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result, { status: 200 });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const fileValue = formData.get("file");

    if (!(fileValue instanceof File)) {
      return NextResponse.json(
        { success: false, error: "A file field is required" },
        { status: 400 },
      );
    }

    const result = await uploadExcel(fileValue);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid form data" },
      { status: 400 },
    );
  }
}
