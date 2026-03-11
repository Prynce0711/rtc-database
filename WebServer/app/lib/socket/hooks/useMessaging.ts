"use client";
import { Message, Messaging } from "@/@types/network";
import { getChatById } from "@/app/components/Messages/MessagesActions";
import { useCallback, useEffect, useState } from "react";
import { SocketEventType, SocketMessage } from "../SocketEvents";
import { useSocket } from "../SocketProvider";

export function useMessaging(chatId: number, fetchMessages = true): Messaging {
  const socket = useSocket().socket;
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const onRecieveData = useSocket().onRecieveData;
  const onMessage = useCallback(
    (event: Message) => {
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
      const result = await getChatById(chatId);
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
      if (event.type === SocketEventType.MESSAGE) {
        onMessage(event.payload as Message);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [onRecieveData, onMessage]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.warn("Socket not open. Cannot send message.");
        return;
      }

      const message: SocketMessage = { content, chatId };

      socket.send(
        JSON.stringify({ type: SocketEventType.MESSAGE, payload: message }),
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

    socket.send(JSON.stringify({ type: SocketEventType.LEAVECHAT }));
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
