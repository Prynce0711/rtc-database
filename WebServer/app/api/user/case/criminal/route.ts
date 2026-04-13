import {
  createCriminalCase,
  getCriminalCases,
} from "@/app/components/Case/Criminal/CriminalCasesActions";
import type { CriminalCasesFilterOptions } from "@/app/components/Case/Criminal/CriminalCaseSchema";
import { CaseType } from "@/app/generated/prisma/client";
import { deleteAllCases } from "@/app/user/test/TestActions";
import { NextResponse } from "next/server";

function parseNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function parseObject(
  value: string | null,
): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function getFilterOptions(
  searchParams: URLSearchParams,
): CriminalCasesFilterOptions | undefined {
  const page = parseNumber(searchParams.get("page"));
  const pageSize = parseNumber(searchParams.get("pageSize"));
  const sortOrder = searchParams.get("sortOrder");
  const sortKey = searchParams.get("sortKey");
  const filters = parseObject(searchParams.get("filters"));
  const exactMatchMap = parseObject(searchParams.get("exactMatchMap"));

  const options: CriminalCasesFilterOptions = {};

  if (page && page > 0) options.page = page;
  if (pageSize && pageSize > 0) options.pageSize = pageSize;
  if (sortOrder === "asc" || sortOrder === "desc")
    options.sortOrder = sortOrder;
  if (sortKey)
    options.sortKey = sortKey as CriminalCasesFilterOptions["sortKey"];
  if (filters) {
    options.filters = filters as CriminalCasesFilterOptions["filters"];
  }
  if (exactMatchMap) {
    options.exactMatchMap =
      exactMatchMap as CriminalCasesFilterOptions["exactMatchMap"];
  }

  return Object.keys(options).length > 0 ? options : undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const options = getFilterOptions(searchParams);
  const result = await getCriminalCases(options);

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result, { status: 200 });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = await createCriminalCase(body);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const result = await deleteAllCases(CaseType.CRIMINAL);

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result, { status: 200 });
}
