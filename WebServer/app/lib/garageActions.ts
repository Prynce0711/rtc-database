import "server-only";

// TODO: Make this server-only and users must first validate session and
// if they are authorized to use file management before calling these functions.
// This will prevent unauthorized users from even being able to call these functions and
// will simplify the code by not having to validate session in each function.
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ActionResult } from "@rtc-database/shared";
import { FileData } from "@rtc-database/shared/prisma/browser";
import { createHash } from "crypto";
import { GetFileOptions, getGarageClient } from "../lib/garage";
import { validateSession } from "./authActions";
import { prisma } from "./prisma";
import { loadSystemSettings } from "./systemSettings";

async function getGarageBucket(): Promise<string> {
  const settings = await loadSystemSettings();
  return settings.garageBucket?.trim() || "uploads";
}

export async function getFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return createHash("sha256").update(Buffer.from(buffer)).digest("hex");
}

export async function uploadFileToGarage(
  file: File,
  fileName?: string,
  folderPath?: string,
): Promise<ActionResult<FileData>>;
export async function uploadFileToGarage(
  file: File,
  key: string,
): Promise<ActionResult<FileData>>;
export async function uploadFileToGarage(
  file: File,
  fileNameOrKey: string = "",
  folderPathParam: string = "",
): Promise<ActionResult<FileData>> {
  return uploadFileToGarageCore(file, fileNameOrKey, folderPathParam, false);
}

// Use this only from trusted server-internal code paths that already validated user access.
export async function uploadFileToGarageTrusted(
  file: File,
  fileNameOrKey: string = "",
  folderPathParam: string = "",
): Promise<ActionResult<FileData>> {
  return uploadFileToGarageCore(file, fileNameOrKey, folderPathParam, true);
}

async function uploadFileToGarageCore(
  file: File,
  fileNameOrKey: string,
  folderPathParam: string,
  skipSessionValidation: boolean,
): Promise<ActionResult<FileData>> {
  try {
    if (!skipSessionValidation) {
      const sessionValidation = await validateSession();
      if (!sessionValidation.success) {
        return sessionValidation;
      }
    }

    const originalExt = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf("."))
      : "";

    let fileName = fileNameOrKey || `${Date.now()}-${file.name}`;
    let folderPath = folderPathParam;
    let key = folderPath ? `${folderPath}/${fileName}` : fileName;

    if (!folderPathParam && fileNameOrKey.includes("/")) {
      key = fileNameOrKey;
      const lastSlash = key.lastIndexOf("/");
      if (lastSlash === key.length - 1) {
        return {
          success: false,
          error: "Invalid key: key cannot end with '/'",
        };
      }
      fileName = key.slice(lastSlash + 1);
      folderPath = key.slice(0, lastSlash);
    }

    if (
      originalExt &&
      !fileName.toLowerCase().endsWith(originalExt.toLowerCase())
    ) {
      fileName = `${fileName}${originalExt}`;
      key = folderPath ? `${folderPath}/${fileName}` : fileName;
    }

    const maxSize = parseInt(process.env.MAX_FILE_SIZE || "50") * 1024 * 1024; // 50 MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: "File too large (max 50MB)",
      };
    }

    const buffer = await file.arrayBuffer();
    const fileHash = createHash("sha256")
      .update(Buffer.from(buffer))
      .digest("hex");

    const existingFile = await prisma.fileData.findUnique({
      where: { key },
    });

    if (existingFile) {
      if (existingFile.fileHash === fileHash) {
        return {
          success: true,
          result: existingFile,
        };
      }

      return {
        success: false,
        error: `A different file already exists for key: ${key}`,
      };
    }

    const bucket = await getGarageBucket();
    const garageClient = await getGarageClient();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: file.type,
    });

    await garageClient.send(command);

    const fileData = await prisma.fileData.create({
      data: {
        fileHash,
        fileName,
        path: folderPath,
        key: key,
        size: file.size,
        mimeType: file.type,
      },
    });

    return {
      success: true,
      result: fileData,
    };
  } catch (err) {
    console.error("Upload error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Upload failed",
    };
  }
}

export async function listGarageFiles(): Promise<
  ActionResult<
    Array<{
      key: string;
      size: number;
      lastModified: Date;
    }>
  >
> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const bucket = await getGarageBucket();
    const garageClient = await getGarageClient();

    const command = new ListObjectsV2Command({
      Bucket: bucket,
    });

    const response = await garageClient.send(command);

    // Filter out folder markers (keys ending with /)
    const files =
      response.Contents?.filter((item) => {
        const key = item.Key || "";
        return !key.endsWith("/");
      }).map((item) => ({
        key: item.Key || "",
        size: item.Size || 0,
        lastModified: item.LastModified || new Date(),
      })) || [];

    return {
      success: true,
      result: files,
    };
  } catch (err) {
    console.error("List files error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to list files",
    };
  }
}

export async function getGarageFileUrl(
  key: string,
  options?: GetFileOptions,
): Promise<ActionResult<string>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const inline = options?.inline ?? false;
    const normalizedFileName = (
      options?.fileName ||
      key.split("/").pop() ||
      "file"
    )
      .replace(/[\r\n"]/g, "")
      .trim();

    const bucket = await getGarageBucket();
    const garageClient = await getGarageClient();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `${inline ? "inline" : "attachment"}; filename="${normalizedFileName}"`,
      ...(options?.contentType
        ? { ResponseContentType: options.contentType }
        : {}),
    });

    const signedUrl = await getSignedUrl(garageClient, command, {
      expiresIn: 3600,
    });

    return {
      success: true,
      result: `/api/user/garage?url=${encodeURIComponent(signedUrl)}`,
    };
  } catch (err) {
    console.error("Get file URL error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to get file URL",
    };
  }
}

export async function deleteGarageFile(
  key: string,
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const bucket = await getGarageBucket();
    const garageClient = await getGarageClient();

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await garageClient.send(command);

    await prisma.fileData.deleteMany({
      where: {
        key: key,
      },
    });

    return {
      success: true,
      result: undefined,
    };
  } catch (err) {
    console.error("Delete file error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete file",
    };
  }
}

export async function moveGarageFile(
  oldKey: string,
  newFolderPath: string,
  newFileName: string,
): Promise<ActionResult<void>>;
export async function moveGarageFile(
  oldKey: string,
  newKey: string,
): Promise<ActionResult<void>>;
export async function moveGarageFile(
  oldKey: string,
  newFolderOrKey: string,
  newFileNameParam: string = "",
): Promise<ActionResult<void>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    let newFolderPath = newFolderOrKey;
    let newFileName = newFileNameParam;
    let newKey = newFolderPath
      ? `${newFolderPath}/${newFileName}`
      : newFileName;

    if (!newFileNameParam && newFolderOrKey.includes("/")) {
      newKey = newFolderOrKey;
      const lastSlash = newKey.lastIndexOf("/");
      if (lastSlash === newKey.length - 1) {
        return {
          success: false,
          error: "Invalid key: key cannot end with '/'",
        };
      }
      newFileName = newKey.slice(lastSlash + 1);
      newFolderPath = newKey.slice(0, lastSlash);
    }

    const bucket = await getGarageBucket();
    const garageClient = await getGarageClient();

    await garageClient.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${oldKey}`,
        Key: newKey,
        MetadataDirective: "COPY",
      }),
    );

    const updateResult = await prisma.fileData.update({
      where: {
        key: oldKey,
      },
      data: {
        key: newKey,
        fileName: newFileName,
        path: newFolderPath,
      },
    });

    if (!updateResult) {
      return {
        success: false,
        error: "File moved but database record was not found.",
      };
    }

    await garageClient.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: oldKey,
      }),
    );

    return {
      success: true,
      result: undefined,
    };
  } catch (err) {
    console.error("Move file error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to move file",
    };
  }
}

export async function createGarageFolder(
  name: string,
  parentPath: string = "",
): Promise<ActionResult<{
  id: number;
  name: string;
  parentPath: string;
  fullPath: string;
}>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const folderName = String(name || "").trim();
    if (!folderName) {
      return { success: false, error: "Folder name is required" };
    }

    const cleanedParent = String(parentPath || "").trim().replace(/^\/+|\/+$/g, "");
    const fullPath = cleanedParent ? `${cleanedParent}/${folderName}` : folderName;

    // check for existing archive entry with same fullPath
    const existing = await prisma.archiveEntry.findUnique({
      where: { fullPath },
    });
    if (existing) {
      return { success: false, error: "A file or folder already exists at that path" };
    }

    const bucket = await getGarageBucket();
    const garageClient = await getGarageClient();

    // Create a zero-byte object with trailing slash to represent folder
    await garageClient.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `${fullPath}/`,
        Body: new Uint8Array(0),
        ContentType: "application/x-directory",
      }),
    );

    const created = await prisma.archiveEntry.create({
      data: {
        name: folderName,
        parentPath: cleanedParent,
        fullPath,
        entryType: "FOLDER",
      },
    });

    return {
      success: true,
      result: {
        id: created.id,
        name: created.name,
        parentPath: created.parentPath,
        fullPath: created.fullPath,
      },
    };
  } catch (err) {
    console.error("Create folder error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create folder",
    };
  }
}
