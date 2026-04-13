import "server-only";

import { messageSchema } from "@/app/components/Messages/schema";
import { prisma } from "@/app/lib/prisma";
import ClientSocketServer from "@/app/lib/socket/ClientSocketServer";
import {
  SocketChatMessage,
  SocketErrorRequestType,
  SocketErrorType,
  SocketEvent,
  SocketEventPayload,
  SocketEventType,
} from "@rtc-database/shared";
import { createHash } from "crypto";
import { WebSocket } from "ws";
import { uploadFileToGarageTrusted } from "../../garageActions";

function sanitizeFileName(fileName: string): string {
  const base = fileName
    .replace(/[\\/]/g, "_")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .trim();
  if (!base) return `upload-${Date.now()}`;
  return base.slice(0, 255);
}

function isBlockedMimeType(mimeType: string): boolean {
  const blocked = new Set([
    "application/x-msdownload",
    "application/x-msdos-program",
    "application/x-sh",
    "application/x-bat",
    "application/x-powershell",
  ]);
  return blocked.has(mimeType.toLowerCase());
}

export async function receiveMessage(
  client: ClientSocketServer,
  payload: SocketChatMessage,
  rateLimited: boolean = false,
) {
  if (rateLimited) {
    console.warn(`Rate limit exceeded for user: ${client.socketUser.name}`);
    sendErrorResponseToSelf(
      client,
      "Rate limit exceeded. Please slow down.",
      SocketErrorRequestType.RATE_LIMIT_EXCEEDED,
    );
    return;
  }

  console.log("Handling message from client:", client.socketUser.name);
  const validation = messageSchema.safeParse(payload);
  if (!validation.success || !validation.data) {
    console.error("Invalid message format:", payload, validation.error);
    client.clientSocket.send(
      JSON.stringify({ error: "Invalid message format" }),
    );
    return;
  }
  console.log("Message content validated");
  const chat = await prisma.chat.findUnique({
    where: { id: payload.chatId },
    include: {
      members: {
        select: { userId: true },
      },
    },
  });
  if (!chat) {
    console.error("Chat not found for ID:", payload.chatId);
    sendErrorResponseToSelf(
      client,
      `Chat with ID ${payload.chatId} not found`,
      SocketErrorRequestType.NOT_FOUND,
    );
    return;
  }
  if (!chat.members.some((m) => m.userId === client.socketUser.id)) {
    console.log("User is not a member of the chat");
    sendErrorResponseToSelf(
      client,
      "You are not a member of this chat",
      SocketErrorRequestType.NOT_FOUND,
    );
    return;
  }
  let newMessage = await prisma.chatMessage.create({
    data: {
      chatId: payload.chatId,
      userId: client.socketUser.id!,
      content: validation.data.content || "Sent an attachment",
    },
  });

  if (validation.data.file) {
    if (isBlockedMimeType(validation.data.file.type)) {
      sendErrorResponseToSelf(
        client,
        "File type is not allowed",
        SocketErrorRequestType.FORBIDDEN,
      );
      await prisma.chatMessage.delete({ where: { id: newMessage.id } });
      return;
    }

    const fileBuffer = Buffer.from(validation.data.file.data, "base64");
    if (!fileBuffer.length || fileBuffer.length !== validation.data.file.size) {
      sendErrorResponseToSelf(
        client,
        "Invalid file payload",
        SocketErrorRequestType.INVALID_DATA,
      );
      await prisma.chatMessage.delete({ where: { id: newMessage.id } });
      return;
    }

    const safeFileName = sanitizeFileName(validation.data.file.name);
    const fileHash = createHash("sha256").update(fileBuffer).digest("hex");
    const key = `${newMessage.chatId}-${fileHash}-${safeFileName}`;

    const fileLike = {
      name: safeFileName,
      type: validation.data.file.type,
      size: fileBuffer.length,
      arrayBuffer: async () =>
        fileBuffer.buffer.slice(
          fileBuffer.byteOffset,
          fileBuffer.byteOffset + fileBuffer.byteLength,
        ),
    } as unknown as File;

    const uploadResult = await uploadFileToGarageTrusted(fileLike, key);
    if (!uploadResult.success) {
      sendErrorResponseToSelf(
        client,
        "Failed to upload file",
        SocketErrorRequestType.FILE_UPLOAD_FAILED,
      );

      await prisma.chatMessage.delete({ where: { id: newMessage.id } });
      console.error("File upload failed:", uploadResult.error);
      return;
    }

    newMessage = await prisma.chatMessage.update({
      where: { id: newMessage.id },
      data: {
        fileId: uploadResult.result.id,
      },
    });
  }

  await prisma.chat.update({
    where: { id: payload.chatId },
    data: { lastMessageAt: new Date() },
  });

  for (const ws of client.server.clients) {
    if (
      ws.readyState === WebSocket.OPEN &&
      chat.members.some((m) => m.userId === ws.userId)
    ) {
      console.log("Sending message to client:", ws.userId, newMessage.content);
      ws.send(
        JSON.stringify({
          type: SocketEventType.RECIEVE_MESSAGE,
          payload: {
            ...newMessage,
            name: client.socketUser.name,
            src: client.socketUser.image ?? undefined,
          },
        } satisfies SocketEvent<SocketEventType.RECIEVE_MESSAGE>),
      );
    }
  }
}

export async function sendMessageToSelf<T extends SocketEventType>(
  client: ClientSocketServer,
  eventType: T,
  payload: SocketEventPayload<T>,
) {
  if (client.clientSocket.readyState !== WebSocket.OPEN) return;
  console.log(`Sending message to self: ${client.socketUser.name}`, {
    eventType,
    payload,
  });
  client.clientSocket.send(JSON.stringify({ type: eventType, payload }));
}

export async function sendMessageToClient<T extends SocketEventType>(
  client: ClientSocketServer,
  eventType: T,
  payload: SocketEventPayload<T>,
  id: string,
) {
  if (id === client.socketUser.id) {
    sendMessageToSelf(client, eventType, payload);
    return;
  }
  for (const ws of client.server.clients) {
    if (ws.readyState === WebSocket.OPEN && ws.userId === id) {
      console.log(`Sending message to client: ${ws.userId}`, {
        eventType,
        payload,
      });
      ws.send(JSON.stringify({ type: eventType, payload }));
    }
  }
}

export async function sendErrorResponseToSelf(
  client: ClientSocketServer,
  message: string,
  errorType: SocketErrorType,
) {
  console.error(
    `Sending error response to self: ${client.socketUser.name} Error: ${message} Code: ${errorType}`,
  );
  sendMessageToSelf(client, SocketEventType.ERROR, {
    message,
    errorType,
  });
}
