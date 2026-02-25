export const formatDate = (date?: Date | string | null) =>
  date
    ? new Date(date).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

export function isDarkMode(): boolean {
  return document.documentElement.getAttribute("data-theme") === "dim";
}

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
