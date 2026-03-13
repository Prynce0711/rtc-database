"use client";

import { FiDownload } from "react-icons/fi";
import ModalBase from "./ModalBase";

export type FileViewerType = "pdf" | "image" | null;

type FileViewerModalProps = {
  open: boolean;
  loading: boolean;
  url: string;
  type: FileViewerType;
  title: string;
  error: string;
  onClose: () => void;
  onDownload?: () => void;
};

export default function FileViewerModal({
  open,
  loading,
  url,
  type,
  title,
  error,
  onClose,
  onDownload,
}: FileViewerModalProps) {
  if (!open) return null;

  return (
    <ModalBase onClose={onClose}>
      <div className="w-[95vw] max-w-6xl rounded-2xl bg-base-100 border border-base-300 shadow-2xl">
        <div className="flex items-center justify-between border-b border-base-300 px-4 py-3">
          <h3 className="text-base font-semibold truncate pr-4">{title}</h3>
          <div className="flex items-center gap-2">
            {onDownload && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={onDownload}
              >
                <FiDownload size={14} />
                Download
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
        <div className="h-[75vh] bg-base-200 p-3">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center">
              <div className="alert alert-error max-w-xl text-sm">
                <span>{error}</span>
              </div>
            </div>
          ) : url ? (
            type === "image" ? (
              <div className="h-full flex items-center justify-center overflow-auto rounded-box bg-base-100">
                <img
                  src={url}
                  alt={title}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <iframe
                src={url}
                className="h-full w-full rounded-box bg-base-100"
                title={title}
              />
            )
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-base-content/60">
              No preview available.
            </div>
          )}
        </div>
      </div>
    </ModalBase>
  );
}
