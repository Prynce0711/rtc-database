import type {
  ActionResult,
  CriminalCaseData,
  ExportExcelData,
  PaginatedResult,
  UploadExcelResult,
} from "@rtc-database/shared";

const API_BASE_URL =
  import.meta.env.VITE_DEV_SERVER_URL || "http://localhost:3000";

export type CriminalCasesQuery = {
  page?: number;
  pageSize?: number;
  sortKey?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, unknown>;
  exactMatchMap?: Record<string, boolean>;
};

type CriminalCasesResponse = ActionResult<PaginatedResult<CriminalCaseData>>;
type CriminalCaseResponse = ActionResult<CriminalCaseData>;
type VoidResponse = ActionResult<void>;
type ExportExcelResponse = ActionResult<ExportExcelData>;
type UploadExcelResponse = ActionResult<UploadExcelResult, UploadExcelResult>;

function buildSearchParams(query?: CriminalCasesQuery) {
  const params = new URLSearchParams();
  if (!query) return params;

  if (query.page && query.page > 0) {
    params.set("page", String(query.page));
  }
  if (query.pageSize && query.pageSize > 0) {
    params.set("pageSize", String(query.pageSize));
  }
  if (query.sortKey) {
    params.set("sortKey", query.sortKey);
  }
  if (query.sortOrder) {
    params.set("sortOrder", query.sortOrder);
  }
  if (query.filters) {
    params.set("filters", JSON.stringify(query.filters));
  }
  if (query.exactMatchMap) {
    params.set("exactMatchMap", JSON.stringify(query.exactMatchMap));
  }

  return params;
}

export async function fetchCriminalCases(
  query?: CriminalCasesQuery,
): Promise<CriminalCasesResponse> {
  try {
    const params = buildSearchParams(query);
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    const response = await fetch(
      `${API_BASE_URL}/api/user/case/criminal${suffix}`,
      {
        method: "GET",
        credentials: "include",
      },
    );

    return (await response.json()) as CriminalCasesResponse;
  } catch {
    return {
      success: false,
      error:
        "Failed to fetch criminal cases. Check server CORS and availability.",
    };
  }
}

export const getCriminalCases = fetchCriminalCases;

export async function createCriminalCase(
  data: Record<string, unknown>,
): Promise<CriminalCaseResponse> {
  const response = await fetch(`${API_BASE_URL}/api/user/case/criminal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(data),
  });

  return (await response.json()) as CriminalCaseResponse;
}

export async function updateCriminalCase(
  caseId: number,
  data: Record<string, unknown>,
): Promise<CriminalCaseResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/user/case/criminal/${caseId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(data),
    },
  );

  return (await response.json()) as CriminalCaseResponse;
}

export async function deleteCriminalCase(
  caseId: number,
): Promise<VoidResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/user/case/criminal/${caseId}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  return (await response.json()) as VoidResponse;
}

export async function deleteAllCases(): Promise<VoidResponse> {
  const response = await fetch(`${API_BASE_URL}/api/user/case/criminal`, {
    method: "DELETE",
    credentials: "include",
  });

  return (await response.json()) as VoidResponse;
}

export async function exportCasesExcel(): Promise<ExportExcelResponse> {
  const response = await fetch(`${API_BASE_URL}/api/user/case/criminal/excel`, {
    method: "GET",
    credentials: "include",
  });

  return (await response.json()) as ExportExcelResponse;
}

export async function uploadExcel(file: File): Promise<UploadExcelResponse> {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch(`${API_BASE_URL}/api/user/case/criminal/excel`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  return (await response.json()) as UploadExcelResponse;
}
