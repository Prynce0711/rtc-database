import {
  deleteCriminalCase,
  getCriminalCaseById,
  updateCriminalCase,
} from "@/app/components/Case/Criminal/CriminalCasesActions";
import { NextResponse } from "next/server";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

async function getId(paramsPromise: RouteParams["params"]) {
  const { id } = await paramsPromise;
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return null;
  }
  return parsedId;
}

export async function GET(_request: Request, context: RouteParams) {
  const id = await getId(context.params);
  if (!id) {
    return NextResponse.json(
      { success: false, error: "Invalid case ID" },
      { status: 400 },
    );
  }

  const result = await getCriminalCaseById(id);
  if (!result.success) {
    return NextResponse.json(result, { status: 404 });
  }

  return NextResponse.json(result, { status: 200 });
}

export async function PATCH(request: Request, context: RouteParams) {
  const id = await getId(context.params);
  if (!id) {
    return NextResponse.json(
      { success: false, error: "Invalid case ID" },
      { status: 400 },
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = await updateCriminalCase(id, body);

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

export async function DELETE(_request: Request, context: RouteParams) {
  const id = await getId(context.params);
  if (!id) {
    return NextResponse.json(
      { success: false, error: "Invalid case ID" },
      { status: 400 },
    );
  }

  const result = await deleteCriminalCase(id);
  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result, { status: 200 });
}
