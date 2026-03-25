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

    const fileUrl = await getGarageFileUrl(message.file.key, {
      inline: !download,
      fileName: message.file.fileName,
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
        fileName: message.file.fileName,
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
