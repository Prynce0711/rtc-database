"use client";

import type { ArchiveAdapter } from "@rtc-database/shared";
import {
  acquireArchiveEditLock,
  acquireArchiveGarageEditLock,
  abortArchiveLargeFileUpload,
  completeArchiveLargeFileUpload,
  createArchiveEntry,
  deleteArchiveGarageItems,
  deleteArchiveEntry,
  getArchiveEntriesByIds,
  getArchiveEntriesPage,
  getArchiveEntryById,
  getArchiveFileUrl,
  getArchiveGarageDirectoryItems,
  getArchiveGarageFileUrl,
  getArchiveStats,
  heartbeatArchiveEditLock,
  heartbeatArchiveGarageEditLock,
  moveArchiveGarageItems,
  releaseArchiveEditLock,
  releaseArchiveGarageEditLock,
  renameArchiveGarageItem,
  startArchiveLargeFileUpload,
  syncArchiveEditedFile,
  syncArchiveGarageEditedFile,
  uploadArchiveLargeFilePart,
  updateArchiveEntry,
} from "./ArchiveActions";

const LARGE_FILE_UPLOAD_CHUNK_BYTES = 16 * 1024 * 1024;

const getUploadErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Upload failed";

const uploadLargeArchiveEntry: ArchiveAdapter["uploadLargeArchiveEntry"] = async (
  data,
  onProgress,
) => {
  const { file, ...entryData } = data;
  const startResult = await startArchiveLargeFileUpload(entryData, {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
  });

  if (!startResult.success) {
    return {
      success: false,
      error: startResult.error || "Failed to start large archive upload",
    };
  }

  const upload = startResult.result;
  const totalParts = Math.max(
    1,
    Math.ceil(file.size / LARGE_FILE_UPLOAD_CHUNK_BYTES),
  );
  const parts: Array<{
    partNumber: number;
    eTag: string;
    checksum: string;
    size: number;
  }> = [];

  try {
    for (let partIndex = 0; partIndex < totalParts; partIndex += 1) {
      const start = partIndex * LARGE_FILE_UPLOAD_CHUNK_BYTES;
      const end = Math.min(start + LARGE_FILE_UPLOAD_CHUNK_BYTES, file.size);
      const chunk = new File([file.slice(start, end)], file.name, {
        type: file.type || "application/octet-stream",
      });
      const partNumber = partIndex + 1;
      const partResult = await uploadArchiveLargeFilePart(
        upload,
        partNumber,
        chunk,
      );

      if (!partResult.success) {
        throw new Error(partResult.error || "Failed to upload file chunk");
      }

      parts.push(partResult.result);
      onProgress?.({
        uploadedBytes: end,
        totalBytes: file.size,
        partNumber,
        totalParts,
      });
    }

    const completeResult = await completeArchiveLargeFileUpload(
      entryData,
      upload,
      parts,
    );

    if (!completeResult.success) {
      throw new Error(
        completeResult.error || "Failed to complete large archive upload",
      );
    }

    onProgress?.({
      uploadedBytes: file.size,
      totalBytes: file.size,
      partNumber: totalParts,
      totalParts,
    });

    return completeResult;
  } catch (error) {
    await abortArchiveLargeFileUpload(upload);
    return {
      success: false,
      error: getUploadErrorMessage(error),
    };
  }
};

export const archiveAdapter: ArchiveAdapter = {
  getArchiveEntriesPage,
  getArchiveStats,
  createArchiveEntry,
  uploadLargeArchiveEntry,
  updateArchiveEntry,
  deleteArchiveEntry,
  getArchiveEntryById,
  getArchiveEntriesByIds,
  getArchiveFileUrl,
  getArchiveGarageDirectoryItems,
  getArchiveGarageFileUrl,
  deleteArchiveGarageItems,
  moveArchiveGarageItems,
  renameArchiveGarageItem,
  acquireArchiveEditLock,
  heartbeatArchiveEditLock,
  releaseArchiveEditLock,
  syncArchiveEditedFile,
  acquireArchiveGarageEditLock,
  heartbeatArchiveGarageEditLock,
  releaseArchiveGarageEditLock,
  syncArchiveGarageEditedFile,
};

export default archiveAdapter;
