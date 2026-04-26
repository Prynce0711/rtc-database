"use client";

import type { Message } from "@rtc-database/shared";
import { useAdaptivePathname, useToast } from "@rtc-database/shared";
import { useEffect } from "react";
import { useSession } from "../authClient";
import { SocketEventType } from "./SocketEvents";
import { useSocket } from "./SocketProvider";

const truncateMessage = (text: string, maxLength: number = 50): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
};

export function ChatNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const onRecieveData = useSocket().onRecieveData;
  const session = useSession();
  const toast = useToast();
  const pathname = useAdaptivePathname();

  useEffect(() => {
    const unsubscribe = onRecieveData((event) => {
      if (!session || !session.data || session.isPending) return;
      const userId = session.data.user.id;

      if (event.type === SocketEventType.RECIEVE_MESSAGE) {
        const message = event.payload as Message;
        if (message.userId === userId) return; // Don't show notification for own messages

        // Show toast if not on messages page
        if (!pathname.includes("/user/messages" + message.chatId)) {
          const truncatedContent = truncateMessage(message.content);
          toast.info(
            truncatedContent,
            4000,
            "/user/messages",
            `New message from ${message.name}`,
          );
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [onRecieveData, pathname, toast]);

  return <>{children}</>;
}
