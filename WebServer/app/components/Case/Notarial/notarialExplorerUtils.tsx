import type { ReactNode } from "react";
import {
  FiFile,
  FiFileText,
  FiFolder,
  FiGrid,
  FiImage,
} from "react-icons/fi";

export type ExplorerFileKind =
  | "folder"
  | "pdf"
  | "word"
  | "excel"
  | "image"
  | "file";

type ExplorerDescriptor = {
  kind: ExplorerFileKind;
  label: string;
  icon: ReactNode;
  iconWrapClassName: string;
  badgeClassName: string;
};

export const formatExplorerBytes = (value?: number | null): string => {
  if (!value || value <= 0) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

export const formatExplorerDateTime = (
  value?: Date | string | null,
): string => {
  if (!value) return "—";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getExplorerFileKind = (options: {
  mimeType?: string | null;
  fileName?: string | null;
  isFolder?: boolean;
}): ExplorerFileKind => {
  if (options.isFolder) return "folder";

  const mimeType = (options.mimeType ?? "").toLowerCase();
  const fileName = (options.fileName ?? "").toLowerCase();

  if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
    return "pdf";
  }

  if (
    mimeType.includes("word") ||
    mimeType.includes("wordprocessingml") ||
    fileName.endsWith(".doc") ||
    fileName.endsWith(".docx")
  ) {
    return "word";
  }

  if (
    mimeType.includes("excel") ||
    mimeType.includes("spreadsheet") ||
    fileName.endsWith(".xls") ||
    fileName.endsWith(".xlsx") ||
    fileName.endsWith(".csv")
  ) {
    return "excel";
  }

  if (mimeType.startsWith("image/")) {
    return "image";
  }

  return "file";
};

export const getExplorerDescriptor = (options: {
  mimeType?: string | null;
  fileName?: string | null;
  isFolder?: boolean;
}): ExplorerDescriptor => {
  const kind = getExplorerFileKind(options);

  switch (kind) {
    case "folder":
      return {
        kind,
        label: "Folder",
        icon: <FiFolder className="h-5 w-5 text-warning" />,
        iconWrapClassName: "bg-warning/12 ring-1 ring-warning/20",
        badgeClassName:
          "border-warning/30 bg-warning/10 text-warning-content dark:text-warning",
      };
    case "pdf":
      return {
        kind,
        label: "PDF",
        icon: <FiFileText className="h-5 w-5 text-error" />,
        iconWrapClassName: "bg-error/10 ring-1 ring-error/20",
        badgeClassName: "border-error/20 bg-error/10 text-error",
      };
    case "word":
      return {
        kind,
        label: "Word",
        icon: <FiFileText className="h-5 w-5 text-info" />,
        iconWrapClassName: "bg-info/10 ring-1 ring-info/20",
        badgeClassName: "border-info/20 bg-info/10 text-info",
      };
    case "excel":
      return {
        kind,
        label: "Excel",
        icon: <FiGrid className="h-5 w-5 text-success" />,
        iconWrapClassName: "bg-success/10 ring-1 ring-success/20",
        badgeClassName: "border-success/20 bg-success/10 text-success",
      };
    case "image":
      return {
        kind,
        label: "Image",
        icon: <FiImage className="h-5 w-5 text-secondary" />,
        iconWrapClassName: "bg-secondary/10 ring-1 ring-secondary/20",
        badgeClassName: "border-secondary/20 bg-secondary/10 text-secondary",
      };
    default:
      return {
        kind,
        label: "File",
        icon: <FiFile className="h-5 w-5 text-base-content/70" />,
        iconWrapClassName: "bg-base-200/70 ring-1 ring-base-300",
        badgeClassName:
          "border-base-300 bg-base-200/80 text-base-content/70",
      };
  }
};

export const getExplorerPathSegments = (path?: string | null) => {
  const normalized = (path ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  return normalized.map((segment, index) => ({
    label: segment,
    path: normalized.slice(0, index + 1).join("/"),
  }));
};
