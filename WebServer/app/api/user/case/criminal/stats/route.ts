import { getCriminalCaseStats } from "@/app/components/Case/Criminal/CriminalCasesActions";
import type { CriminalCasesFilterOptions } from "@/app/components/Case/Criminal/CriminalCaseSchema";
import { NextResponse } from "next/server";

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
  const filters = parseObject(searchParams.get("filters"));
  const exactMatchMap = parseObject(searchParams.get("exactMatchMap"));
  const options: CriminalCasesFilterOptions = {};

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
  const result = await getCriminalCaseStats(options);

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result, { status: 200 });
}
