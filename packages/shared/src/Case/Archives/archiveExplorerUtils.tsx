import type { ReactNode } from "react";
import { ArchiveEntryType } from "../../generated/prisma/enums";
import {
  FiFile,
  FiFileText,
  FiFolder,
  FiGrid,
  FiImage,
} from "react-icons/fi";

export type ArchiveVisualDescriptor = {
  label: string;
  icon: ReactNode;
  iconWrapClassName: string;
  badgeClassName: string;
};

export const formatArchiveBytes = (value?: number | null): string => {
  if (!value || value <= 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

export const formatArchiveDateTime = (
  value?: Date | string | null,
): string => {
  if (!value) return "-";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isPdf = (mimeType?: string | null, name?: string | null) =>
  (mimeType ?? "").toLowerCase() === "application/pdf" ||
  (name ?? "").toLowerCase().endsWith(".pdf");

const isWord = (mimeType?: string | null, name?: string | null) => {
  const normalizedMime = (mimeType ?? "").toLowerCase();
  const normalizedName = (name ?? "").toLowerCase();
  return (
    normalizedMime.includes("word") ||
    normalizedMime.includes("wordprocessingml") ||
    normalizedName.endsWith(".doc") ||
    normalizedName.endsWith(".docx")
  );
};

const isExcel = (mimeType?: string | null, name?: string | null) => {
  const normalizedMime = (mimeType ?? "").toLowerCase();
  const normalizedName = (name ?? "").toLowerCase();
  return (
    normalizedMime.includes("excel") ||
    normalizedMime.includes("spreadsheet") ||
    normalizedName.endsWith(".xls") ||
    normalizedName.endsWith(".xlsx") ||
    normalizedName.endsWith(".csv")
  );
};

const isImage = (mimeType?: string | null) =>
  (mimeType ?? "").toLowerCase().startsWith("image/");

export const getArchiveDescriptor = (options: {
  entryType: ArchiveEntryType;
  mimeType?: string | null;
  name?: string | null;
}): ArchiveVisualDescriptor => {
  if (options.entryType === ArchiveEntryType.FOLDER) {
    return {
      label: "Folder",
      icon: <FiFolder className="h-5 w-5 text-warning" />,
      iconWrapClassName: "bg-warning/12 ring-1 ring-warning/20",
      badgeClassName:
        "border-warning/30 bg-warning/10 text-warning-content dark:text-warning",
    };
  }

  if (options.entryType === ArchiveEntryType.SPREADSHEET || isExcel(options.mimeType, options.name)) {
    return {
      label: "Excel",
      icon: <FiGrid className="h-5 w-5 text-success" />,
      iconWrapClassName: "bg-success/10 ring-1 ring-success/20",
      badgeClassName: "border-success/20 bg-success/10 text-success",
    };
  }

  if (isPdf(options.mimeType, options.name)) {
    return {
      label: "PDF",
      icon: <FiFileText className="h-5 w-5 text-error" />,
      iconWrapClassName: "bg-error/10 ring-1 ring-error/20",
      badgeClassName: "border-error/20 bg-error/10 text-error",
    };
  }

  if (options.entryType === ArchiveEntryType.DOCUMENT || isWord(options.mimeType, options.name)) {
    return {
      label: "Word",
      icon: <FiFileText className="h-5 w-5 text-info" />,
      iconWrapClassName: "bg-info/10 ring-1 ring-info/20",
      badgeClassName: "border-info/20 bg-info/10 text-info",
    };
  }

  if (isImage(options.mimeType)) {
    return {
      label: "Image",
      icon: <FiImage className="h-5 w-5 text-secondary" />,
      iconWrapClassName: "bg-secondary/10 ring-1 ring-secondary/20",
      badgeClassName: "border-secondary/20 bg-secondary/10 text-secondary",
    };
  }

  return {
    label: "File",
    icon: <FiFile className="h-5 w-5 text-base-content/70" />,
    iconWrapClassName: "bg-base-200/70 ring-1 ring-base-300",
    badgeClassName: "border-base-300 bg-base-200/80 text-base-content/70",
  };
};
