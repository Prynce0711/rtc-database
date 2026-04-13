"use client";

import { ChatData } from "@/@types/network";
import {
  createManyChatsWithOthers,
  getChats,
  removeManyChatsWithOthers,
} from "@/app/components/Messages/MessagesActions";
import { useMessaging } from "@/app/lib/socket/hooks/useMessaging";
import { useSocket } from "@/app/lib/socket/SocketProvider";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@rtc-database/shared";

export default function ChatTest() {
  const [chatIdInput, setChatIdInput] = useState("1");
  const [activeChatId, setActiveChatId] = useState<number | null>(1);
  const [messageInput, setMessageInput] = useState("");
  const [fetchMessages, setFetchMessages] = useState(true);
  const [availableChats, setAvailableChats] = useState<ChatData[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [roleInput, setRoleInput] = useState("user");
  const [userIdInput, setUserIdInput] = useState("");
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const session = useSession();
  const currentUserId = session.data?.user?.id;

  const chatId = useMemo(() => activeChatId ?? 0, [activeChatId]);
  const { messages, sendMessage, loading } = useMessaging(
    chatId,
    fetchMessages,
  );
  const { socket } = useSocket();

  const socketState = useMemo(() => {
    if (!socket) return "disconnected";
    switch (socket.readyState) {
      case WebSocket.CONNECTING:
        return "connecting";
      case WebSocket.OPEN:
        return "open";
      case WebSocket.CLOSING:
        return "closing";
      case WebSocket.CLOSED:
        return "closed";
      default:
        return "unknown";
    }
  }, [socket]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  useEffect(() => {
    void loadChats();
  }, []);

  const loadChats = async () => {
    setChatLoading(true);
    const result = await getChats();
    if (result.success) {
      setAvailableChats(result.result);
    }
    setChatLoading(false);
  };

  const handleLoadChat = () => {
    const nextId = Number(chatIdInput);
    if (!Number.isFinite(nextId) || nextId <= 0) return;
    setActiveChatId(nextId);
  };

  const handleSend = async () => {
    const trimmed = messageInput.trim();
    if (!trimmed) return;
    await sendMessage(trimmed);
    setMessageInput("");
  };

  const handleSelectChat = (value: string) => {
    if (!value) return;
    setChatIdInput(value);
    const nextId = Number(value);
    if (Number.isFinite(nextId) && nextId > 0) {
      setActiveChatId(nextId);
    }
  };

  const handleCreateChats = async () => {
    const effectiveUserId = userIdInput.trim() || currentUserId || "";
    if (!roleInput || !effectiveUserId) return;
    setBulkStatus("Creating chats...");
    await createManyChatsWithOthers(roleInput as never, effectiveUserId);
    await loadChats();
    setBulkStatus("Created missing chats.");
  };

  const handleRemoveChats = async () => {
    const effectiveUserId = userIdInput.trim() || currentUserId || "";
    if (!roleInput || !effectiveUserId) return;
    setBulkStatus("Removing chats...");
    await removeManyChatsWithOthers(roleInput as never, effectiveUserId);
    await loadChats();
    setBulkStatus("Removed chats.");
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold">Chat ID</label>
            <input
              className="input input-bordered input-sm w-32"
              value={chatIdInput}
              onChange={(event) => setChatIdInput(event.target.value)}
              placeholder="Chat ID"
              inputMode="numeric"
            />
            <button className="btn btn-primary btn-sm" onClick={handleLoadChat}>
              Load Chat
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold">Existing chats</label>
            <select
              className="select select-bordered select-sm min-w-60"
              value=""
              onChange={(event) => handleSelectChat(event.target.value)}
            >
              <option value="" disabled>
                {chatLoading ? "Loading..." : "Select chat"}
              </option>
              {availableChats.map((chat) => (
                <option key={chat.id} value={String(chat.id)}>
                  #{chat.id} {chat.name}
                </option>
              ))}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={loadChats}>
              Refresh
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                checked={fetchMessages}
                onChange={(event) => setFetchMessages(event.target.checked)}
              />
              Fetch history
            </label>
            <span className="text-xs uppercase tracking-wide text-base-content/70">
              Socket: {socketState}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold">Role</label>
            <select
              className="select select-bordered select-sm w-48"
              value={roleInput}
              onChange={(event) => setRoleInput(event.target.value)}
            >
              <option value="admin">admin</option>
              <option value="user">user</option>
              <option value="atty">atty</option>
              <option value="statistics">statistics</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold">User ID</label>
            <input
              className="input input-bordered input-sm w-80"
              value={userIdInput}
              onChange={(event) => setUserIdInput(event.target.value)}
              placeholder="Current user id"
            />
            <span className="text-xs text-base-content/70">
              Current user: {currentUserId ?? "not signed in"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="btn btn-primary btn-sm"
              onClick={handleCreateChats}
            >
              Create Chats
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={handleRemoveChats}
            >
              Remove Chats
            </button>
          </div>
          {bulkStatus ? (
            <span className="text-xs text-base-content/70">{bulkStatus}</span>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-base-300 bg-base-100 shadow-sm">
        <div className="border-b border-base-300 px-4 py-3 text-sm font-semibold">
          Active chat: {activeChatId ?? "none"}
          {loading ? " (loading...)" : ""}
        </div>
        <div ref={scrollRef} className="h-105 overflow-y-auto px-4 py-3">
          {messages.length === 0 ? (
            <div className="text-sm text-base-content/60">
              No messages loaded yet.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="rounded-md border border-base-200 bg-base-200/40 p-3"
                >
                  <div className="flex items-center justify-between text-xs text-base-content/60">
                    <span className="font-semibold text-base-content">
                      {message.name}
                    </span>
                    <span>{new Date(message.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="mt-2 text-sm">
                    {typeof message.content === "string"
                      ? message.content
                      : "[binary message]"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          <textarea
            className="textarea textarea-bordered min-h-30"
            placeholder="Type a message"
            value={messageInput}
            onChange={(event) => setMessageInput(event.target.value)}
          />
          <div className="flex items-center justify-end">
            <button className="btn btn-primary" onClick={handleSend}>
              Send Message
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
