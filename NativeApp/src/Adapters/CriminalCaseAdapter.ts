import {
  IPC_CHANNELS,
  type ActionResult,
  type CriminalCaseAdapter,
  type CriminalCaseData,
  type CriminalCasesFilterOptions,
  type CriminalCaseStats,
  type PaginatedResult,
  type UnifiedCaseData,
  type UnifiedCasesOptions,
} from "@rtc-database/shared";

const invokeIpc = async <T>(
  channel: string,
  ...args: unknown[]
): Promise<T> => {
  const ipcRenderer = window.ipcRenderer;

  if (!ipcRenderer?.invoke) {
    throw new Error("IPC bridge is unavailable in the renderer.");
  }

  return ipcRenderer.invoke(channel, ...args) as Promise<T>;
};

const criminalCaseAdapter: CriminalCaseAdapter = {
  doesCaseExist: (caseNumbers, caseType) =>
    invokeIpc<ActionResult<string[]>>(IPC_CHANNELS.CASE_DOES_EXIST, {
      caseNumbers,
      caseType,
    }),
  getCases: (options?: UnifiedCasesOptions) =>
    invokeIpc<ActionResult<PaginatedResult<UnifiedCaseData>>>(
      IPC_CHANNELS.CASE_GETS,
      options,
    ),
  getCaseStats: (options) =>
    invokeIpc<ActionResult<CriminalCaseStats>>(
      IPC_CHANNELS.CASE_STATS,
      options,
    ),
  getCriminalCases: (options?: CriminalCasesFilterOptions) =>
    invokeIpc<ActionResult<PaginatedResult<CriminalCaseData>>>(
      IPC_CHANNELS.CRIMINAL_CASES_GET,
      options,
    ),
  getCriminalCaseStats: (options?: CriminalCasesFilterOptions) =>
    invokeIpc<ActionResult<CriminalCaseStats>>(
      IPC_CHANNELS.CRIMINAL_CASES_STATS,
      options,
    ),
  createCriminalCase: () => {
    throw new Error("Not implemented in Electron");
  },
  getCriminalCaseNumberPreview: (area: string, year: number) =>
    invokeIpc<ActionResult<{ caseNumber: string; nextNumber: number }>>(
      IPC_CHANNELS.CRIMINAL_CASE_NUMBER_PREVIEW,
      { area, year },
    ),
  updateCriminalCase: () => {
    throw new Error("Not implemented in Electron");
  },
  deleteCriminalCase: () => {
    throw new Error("Not implemented in Electron");
  },
  getCriminalCaseById: (id: string | number) =>
    invokeIpc<ActionResult<CriminalCaseData>>(
      IPC_CHANNELS.CRIMINAL_CASE_GET_BY_ID,
      id,
    ),
  getCriminalCasesByIds: (ids: (string | number)[]) =>
    invokeIpc<ActionResult<CriminalCaseData[]>>(
      IPC_CHANNELS.CRIMINAL_CASE_GET_BY_IDS,
      ids,
    ),
  getCriminalCasesByCaseNumbers: (caseNumbers: string[]) =>
    invokeIpc<ActionResult<CriminalCaseData[]>>(
      IPC_CHANNELS.CRIMINAL_CASE_GET_BY_CASE_NUMBERS,
      caseNumbers,
    ),
  uploadExcel: () => {
    throw new Error("Not implemented in Electron");
  },
  exportCasesExcel: () => {
    throw new Error("Not implemented in Electron");
  },
};

export default criminalCaseAdapter;
