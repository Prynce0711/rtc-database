// Local type until a Prisma ReceiveLog model is added to schema.prisma
export interface ReceiveLog {
  id: number;
  receiptNo: string;
  dateReceived: Date | string;
  timeReceived?: string | null;
  caseNumber: string;
  documentType: string;
  party: string;
  receivedBy: string;
  branch: string;
  remarks?: string | null;
}

export interface ReceiveLogStats {
  total: number;
  today: number;
  thisMonth: number;
  docTypes: number;
}

export const calculateReceiveLogStats = (
  logs: ReceiveLog[],
): ReceiveLogStats => {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  const toDateStr = (d: Date | string): string =>
    typeof d === "string" ? d : d.toISOString();

  return {
    total: logs.length,
    today: logs.filter((l) => toDateStr(l.dateReceived).slice(0, 10) === today)
      .length,
    thisMonth: logs.filter((l) =>
      toDateStr(l.dateReceived).startsWith(thisMonth),
    ).length,
    docTypes: new Set(logs.map((l) => l.documentType)).size,
  };
};

export const sortReceiveLogs = (
  logs: ReceiveLog[],
  sortBy: keyof ReceiveLog,
  order: "asc" | "desc",
): ReceiveLog[] => {
  return [...logs].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (aVal < bVal) return order === "asc" ? -1 : 1;
    if (aVal > bVal) return order === "asc" ? 1 : -1;
    return 0;
  });
};
