import { Prisma } from "@rtc-database/shared/prisma/browser";
import { excelHeaders } from "@/app/lib/excel";
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

export function generateFileKey(data: NotarialFileKeyInput): string {
  const titleStr = data.title ? `${data.title}-` : "";
  const attyStr = data.attorney ? `${data.attorney}-` : "";
  const nameStr = data.name ? `${data.name}-` : "";
  const dateStr = data.date ? `${data.date.toISOString().split("T")[0]}` : "";
  const hashStr = data.fileHash ? `-${data.fileHash.slice(0, 12)}` : "";

  const fileName = `${titleStr}${attyStr}${nameStr}${dateStr}${hashStr}`;

  const year = data.date ? data.date.getFullYear() : "unknown-year";
  const folderPath = data.attorney ? `${data.attorney}/${year}` : "";

  return folderPath ? `${folderPath}/${fileName}` : fileName;
}
