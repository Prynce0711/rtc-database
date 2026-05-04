import { Prisma } from "@rtc-database/shared/prisma/browser";
import { excelHeaders } from "@rtc-database/shared";
import z from "zod";

const NotarialData = {
  include: {
    file: true,
  },
} satisfies Prisma.NotarialDefaultArgs;
export type NotarialData = Prisma.NotarialGetPayload<typeof NotarialData>;

export const NotarialSchema = z.object({
  title: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Title"])),
  name: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Name"])),
  attorney: z
    .string()
    .nullable()
    .optional()
    .describe(excelHeaders(["Attorney", "Atty"])),
  date: z.coerce
    .date()
    .nullable()
    .optional()
    .describe(excelHeaders(["Date Filed", "Filing Date"])),
  file: z.file().nullable().optional(),
  path: z
    .string()
    .optional()
    .nullable()
    .describe(excelHeaders(["Link", "Path", "File Path"])),
  removeFile: z
    .boolean()
    .optional()
    .describe("Set to true to remove existing file"),
});
export type NotarialSchema = z.infer<typeof NotarialSchema>;

export type NotarialFileKeyInput = {
  title?: string | null;
  name?: string | null;
  attorney?: string | null;
  date?: Date | null;
  fileHash?: string | null;
};

function sanitizeGarageKeySegment(
  value: string | null | undefined,
  fallback = "",
): string {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[\u0000-\u001f\u007f]+/g, "")
    .replace(/[\\/:*?"<>|#%{}[\]~&]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  return normalized || fallback;
}

export function generateFileKey(data: NotarialFileKeyInput): string {
  const titlePart = sanitizeGarageKeySegment(data.title);
  const attyPart = sanitizeGarageKeySegment(data.attorney);
  const namePart = sanitizeGarageKeySegment(data.name);
  const datePart = data.date ? data.date.toISOString().split("T")[0] : "";
  const hashPart = data.fileHash?.slice(0, 12) ?? "";

  const fileName = [
    titlePart,
    attyPart,
    namePart,
    datePart,
    hashPart,
  ]
    .filter(Boolean)
    .join("-");
  const safeFileName = fileName || "notarial-file";

  const year = data.date ? String(data.date.getFullYear()) : "unknown-year";
  const folderAttorney = sanitizeGarageKeySegment(data.attorney, "Unassigned");
  const folderPath = `${folderAttorney}/${year}`;

  return `${folderPath}/${safeFileName}`;
}
