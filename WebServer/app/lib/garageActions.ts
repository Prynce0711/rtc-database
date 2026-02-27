"use server";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import ActionResult from "../components/ActionResult";
import { garage } from "../lib/garage";
import { validateSession } from "./authActions";

export async function uploadFileToGarage(
  file: File,
  key: string = `${Date.now()}-${file.name}`,
): Promise<ActionResult<string>> {
  try {
    const sessionValidation = await validateSession();
    if (!sessionValidation.success) {
      return sessionValidation;
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

    return {
      success: true,
      result: key,
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
