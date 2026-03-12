"use server";

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import ActionResult from "../components/ActionResult";
import { FileData } from "../generated/prisma/browser";
import { garage } from "../lib/garage";
import { validateSession } from "./authActions";
import { prisma } from "./prisma";

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
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
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

    const command = new PutObjectCommand({
      Bucket: process.env.GARAGE_BUCKET || "uploads",
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: file.type,
    });

    await garage.send(command);

    const fileData = await prisma.fileData.create({
      data: {
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

    const command = new ListObjectsV2Command({
      Bucket: process.env.GARAGE_BUCKET || "uploads",
    });

    const response = await garage.send(command);

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
): Promise<ActionResult<string>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
    }

    const command = new GetObjectCommand({
      Bucket: process.env.GARAGE_BUCKET || "uploads",
      Key: key,
    });

    // Generate a presigned URL valid for 1 hour
    const url = await getSignedUrl(garage, command, { expiresIn: 3600 });

    return {
      success: true,
      result: url,
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

    const command = new DeleteObjectCommand({
      Bucket: process.env.GARAGE_BUCKET || "uploads",
      Key: key,
    });

    await garage.send(command);

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

    const bucket = process.env.GARAGE_BUCKET || "uploads";

    await garage.send(
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

    await garage.send(
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
