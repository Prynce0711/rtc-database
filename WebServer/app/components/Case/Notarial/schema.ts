import { Prisma } from "@/app/generated/prisma/browser";
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
  removeFile: z
    .boolean()
    .optional()
    .describe("Set to true to remove existing file"),
});
export type NotarialSchema = z.infer<typeof NotarialSchema>;

export function generateFileKey(data: NotarialSchema): string {
  const titleStr = data.title ? `${data.title}-` : "";
  const attyStr = data.attorney ? `${data.attorney}-` : "";
  const nameStr = data.name ? `${data.name}-` : "";
  const dateStr = data.date ? `${data.date.toISOString().split("T")[0]}` : "";

  const fileName = `${titleStr}${attyStr}${nameStr}${dateStr}`;

  const year = data.date ? data.date.getFullYear() : "unknown-year";
  const folderPath = data.attorney ? `${data.attorney}/${year}` : "";

  return folderPath ? `${folderPath}/${fileName}` : fileName;
}
