import type { ChatMessage, ChatType } from "@/app/generated/prisma/browser";
import Roles from "@/app/lib/Roles";
import type { Recipient } from "@/app/lib/socket/SocketEvents";

declare module "ws" {
  interface WebSocket {
    userId?: string;
    userType?: Roles;
    chatId?: number;
    callId?: string; // Added callId to WebSocket interface
    socketId?: string; // Added socketId to WebSocket interface
  }
  interface WebSocketServer {
    clients: Set<WebSocket>;
  }
}

export interface Messaging {
  messages: Message[];
  loading: boolean;
  sendMessage: (content: string, file?: File) => Promise<void>;
}

export interface Message extends ChatMessage {
  name: string;
  src?: string;
}

export interface ChatData {
  id: number;
  name: string;
  email: string;
  type: ChatType;
  latestMessage?: Message;
  src?: string;
  members?: Recipient[];
  // status: UserStatus;
}

export {};
