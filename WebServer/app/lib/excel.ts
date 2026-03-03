export type ExportExcelData = {
  fileName: string;
  base64: string;
};

// Helper to convert Excel serial date to JS Date
export const excelDateToJSDate = (serial: number): Date => {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  return new Date(
    dateInfo.getFullYear(),
    dateInfo.getMonth(),
    dateInfo.getDate(),
  );
};

// Helper to generate variations with periods after words
const generatePeriodVariations = (text: string): string[] => {
  const words = text.split(/\s+/);
  if (words.length === 1) {
    // Single word: "atty" → ["atty", "atty."]
    return [text, text + "."];
  }

  // Multiple words: generate all combinations with periods
  const variations: string[] = [text];
  const n = words.length;

  // Generate all combinations using binary representation
  // For 2 words: 00, 01, 10, 11 (4 combinations)
  for (let i = 1; i < 1 << n; i++) {
    const variant = words
      .map((word, index) => {
        // Check if this word should have a period
        const shouldHavePeriod = (i >> index) & 1;
        return shouldHavePeriod ? word + "." : word;
      })
      .join(" ");
    variations.push(variant);
  }

  return variations;
};

// Fuzzy column name matcher
export const findColumnValue = (row: any, possibleNames: string[]): any => {
  // Generate all variations with periods
  const allVariations: string[] = [];
  for (const name of possibleNames) {
    allVariations.push(...generatePeriodVariations(name));
  }

  // First try exact match (case-insensitive)
  for (const name of allVariations) {
    for (const key in row) {
      if (key.toLowerCase().trim() === name.toLowerCase().trim()) {
        return row[key];
      }
    }
  }

  // Then try partial match
  for (const name of allVariations) {
    for (const key in row) {
      const keyLower = key.toLowerCase().trim();
      const nameLower = name.toLowerCase().trim();
      if (keyLower.includes(nameLower) || nameLower.includes(keyLower)) {
        return row[key];
      }
    }
  }

  return undefined;
};

export async function isExcel(file: File): Promise<boolean> {
  try {
    const validMimeTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/x-excel",
    ];

    if (!validMimeTypes.includes(file.type)) {
      return false;
    }

    const validExtensions = [".xlsx", ".xls"];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some((ext) =>
      fileName.endsWith(ext),
    );

    if (!hasValidExtension) {
      return false;
    }

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const isXlsx =
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      bytes[2] === 0x03 &&
      bytes[3] === 0x04;
    const isXls =
      bytes[0] === 0xd0 &&
      bytes[1] === 0xcf &&
      bytes[2] === 0x11 &&
      bytes[3] === 0xe0 &&
      bytes[4] === 0xa1 &&
      bytes[5] === 0xb1 &&
      bytes[6] === 0x1a &&
      bytes[7] === 0xe1;

    return isXlsx || isXls;
  } catch (error) {
    return false;
  }
}
