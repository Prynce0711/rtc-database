"use client";
import { useCallback, useEffect, useState } from "react";
import ActionResult from "../../../ActionResult";
import type {
  Messaging,
  Message as NetworkMessage,
} from "../../../types/network";
import { SocketChatMessage, SocketEventType } from "../SocketEvents";
import { useSocket } from "../SocketProvider";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function useMessaging(
  chatId: number,
  fetchMessages = true,
  getChatByID: (id: number) => Promise<ActionResult<NetworkMessage[]>>,
): Messaging {
  const socket = useSocket().socket;
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<NetworkMessage[]>([]);
  const onRecieveData = useSocket().onRecieveData;
  const onMessage = useCallback(
    (event: NetworkMessage) => {
      console.log("Received socket message:", event);
      if (event.chatId !== chatId) return;
      setMessages((prev) => [...prev, event]);
    },
    [chatId],
  );

  useEffect(() => {
    console.log("Loading messages for chat:", chatId);
    setLoading(true);
    setMessages([]);
    if (!fetchMessages) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const loadData = async () => {
      const result = await getChatByID(chatId);
      if (!cancelled && result.success) {
        setMessages(result.result);
      }
      if (!cancelled) {
        setLoading(false);
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [chatId, fetchMessages]);

  useEffect(() => {
    const unsubscribe = onRecieveData((event) => {
      if (event.type === SocketEventType.RECIEVE_MESSAGE) {
        onMessage(event.payload);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [onRecieveData, onMessage]);

  const sendMessage = useCallback(
    async (content: string, file?: File) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.warn("Socket not open. Cannot send message.");
        return;
      }

      let message: SocketChatMessage = { content, chatId };
      if (file) {
        const buffer = await file.arrayBuffer();
        message = {
          ...message,
          file: {
            name: file.name,
            type: file.type,
            size: file.size,
            data: arrayBufferToBase64(buffer),
          },
        };
      }

      socket.send(
        JSON.stringify({
          type: SocketEventType.SEND_MESSAGE,
          payload: message,
        }),
      );
    },
    [socket, chatId],
  );

  const joinChat = useCallback(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn("Socket not open. Cannot join chat.");
      return;
    }

    socket.send(
      JSON.stringify({ type: SocketEventType.JOINCHAT, payload: { chatId } }),
    );
  }, [socket, chatId]);

  const leaveChat = useCallback(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn("Socket not open. Cannot leave chat.");
      return;
    }

    socket.send(
      JSON.stringify({ type: SocketEventType.LEAVECHAT, payload: { chatId } }),
    );
  }, [socket, chatId]);

  useEffect(() => {
    if (!socket) {
      console.warn("Socket not initialized.");
      return;
    }

    joinChat();

    return () => {
      leaveChat();
    };
  }, [socket, chatId]);

  return { messages, sendMessage, loading } as const;
}
