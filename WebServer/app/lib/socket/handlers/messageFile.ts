"use server";

import ActionResult from "@/app/components/ActionResult";
import { validateSession } from "../../authActions";
import { getGarageFileUrl } from "../../garageActions";
import { prisma } from "../../prisma";

export type MessageFileAccess = {
  url: string;
  mimeType: string;
  fileName: string;
  isImage: boolean;
};

function sanitizeDownloadName(rawFileName: string): string {
  const safe = rawFileName.trim();
  if (!safe) return "attachment";

  // Stored keys may look like: <chatId>-<sha256>-<originalName>
  const prefixed = safe.match(/^\d+-[a-f0-9]{32,128}-(.+)$/i);
  if (prefixed?.[1]) return prefixed[1];

  // Fallback: remove only leading numeric id prefix if present.
  const numericPrefixed = safe.match(/^\d+-(.+)$/);
  if (numericPrefixed?.[1]) return numericPrefixed[1];

  return safe;
}

export async function getFileUrl(
  messageId: number,
  download: boolean = false,
): Promise<ActionResult<MessageFileAccess>> {
  try {
    if (!Number.isInteger(messageId) || messageId <= 0) {
      return {
        success: false,
        error: "Invalid message ID",
      };
    }

    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const message = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        chat: {
          members: {
            some: {
              userId: sessionResult.result.id,
            },
          },
        },
      },
      include: { file: true },
    });

    if (!message || !message.file) {
      return {
        success: false,
        error: "Message or associated file not found",
      };
    }

    const downloadName = sanitizeDownloadName(message.file.fileName);

    const fileUrl = await getGarageFileUrl(message.file.key, {
      inline: !download,
      fileName: downloadName,
      contentType: message.file.mimeType,
    });
    if (!fileUrl.success) {
      return {
        success: false,
        error: "Failed to get file URL",
      };
    }

    return {
      success: true,
      result: {
        url: fileUrl.result,
        mimeType: message.file.mimeType,
        fileName: downloadName,
        isImage: message.file.mimeType.startsWith("image/"),
      },
    };
  } catch (error) {
    console.error("Error getting file URL:", error);
    return {
      success: false,
      error: "Failed to get file URL",
    };
  }
}
