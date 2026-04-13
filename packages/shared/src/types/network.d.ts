import "ws";
import type { ChatMessage, ChatType, User } from "../generated/prisma/browser";
import Roles from "../lib/Roles";

type Recipient = Pick<User, "id" | "name" | "image">;

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
