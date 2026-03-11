"use client";

import { ChatData, Message as NetworkMessage } from "@/@types/network";
import {
  createGroupChat as createGroupChatAction,
  getChats,
} from "@/app/components/Messages/MessagesActions";
import { usePopup } from "@/app/components/Popup/PopupProvider";
import { useSession } from "@/app/lib/authClient";
import { useMessaging } from "@/app/lib/socket/hooks/useMessaging";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BsPin, BsPinFill } from "react-icons/bs";
import {
  FiAlertTriangle,
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiFile,
  FiImage,
  FiMaximize2,
  FiMoreHorizontal,
  FiPaperclip,
  FiPhone,
  FiSearch,
  FiSend,
  FiSmile,
  FiTrash2,
  FiUsers,
  FiVideo,
  FiX,
} from "react-icons/fi";

// ─── Types ────────────────────────────────────────────────────────────────────
interface User {
  id: string;
  name: string;
  role: "admin" | "atty" | "user";
  avatar?: string;
  isOnline: boolean;
  lastSeen?: string;
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  status: "sent" | "delivered" | "read";
  type: "text" | "image" | "file";
  isPinned?: boolean;
  isDeleted?: boolean;
  fileName?: string;
  fileSize?: string;
  imageUrl?: string;
}

interface Conversation {
  id: string;
  participant: User;
  participants?: User[]; // for group chats
  groupName?: string;
  isGroup?: boolean;
  messages: Message[];
  lastMessage: Message;
  unreadCount: number;
  isPinned: boolean;
  isTyping?: boolean;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const CURRENT_USER_ID = "me";

const mockUsers: User[] = [
  { id: "u1", name: "Atty. Maria Santos", role: "atty", isOnline: true },
  { id: "u2", name: "Juan Dela Cruz", role: "user", isOnline: true },
  {
    id: "u3",
    name: "Admin Rodriguez",
    role: "admin",
    isOnline: false,
    lastSeen: "2026-02-27T08:30:00",
  },
  {
    id: "u4",
    name: "Atty. Carlos Reyes",
    role: "atty",
    isOnline: false,
    lastSeen: "2026-02-27T07:15:00",
  },
  { id: "u5", name: "Elena Garcia", role: "user", isOnline: true },
  {
    id: "u6",
    name: "Atty. Sofia Mendoza",
    role: "atty",
    isOnline: false,
    lastSeen: "2026-02-26T18:45:00",
  },
  { id: "u7", name: "Roberto Tan", role: "user", isOnline: true },
  {
    id: "u8",
    name: "Admin Patricia Lim",
    role: "admin",
    isOnline: false,
    lastSeen: "2026-02-27T09:00:00",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const formatFullTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const formatLastSeen = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 60) return `Active ${diffMins}m ago`;
  if (diffHours < 24) return `Active ${diffHours}h ago`;
  return `Last seen ${d.toLocaleDateString([], { month: "short", day: "numeric" })}`;
};

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter((w) => w[0] && w[0] === w[0].toUpperCase())
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

const getRoleBadge = (role: string) => {
  switch (role) {
    case "admin":
      return { label: "Admin", cls: "bg-error/15 text-error" };
    case "atty":
      return { label: "Attorney", cls: "bg-info/15 text-info" };
    default:
      return { label: "Staff", cls: "bg-success/15 text-success" };
  }
};

const getAvatarColor = (name: string) => {
  const colors = [
    "bg-primary text-primary-content",
    "bg-secondary text-secondary-content",
    "bg-accent text-accent-content",
    "bg-info text-info-content",
    "bg-success text-success-content",
    "bg-warning text-warning-content",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

// ─── Sub-Components ───────────────────────────────────────────────────────────

/** Online indicator dot */
const OnlineDot = ({
  isOnline,
  size = "md",
}: {
  isOnline: boolean;
  size?: "sm" | "md";
}) => (
  <span
    className={[
      "absolute rounded-full border-2 border-base-100",
      isOnline ? "bg-success" : "bg-base-content/30",
      size === "sm"
        ? "w-2.5 h-2.5 bottom-0 right-0"
        : "w-3.5 h-3.5 -bottom-0.5 -right-0.5",
    ].join(" ")}
  />
);

/** User avatar with online indicator */
const UserAvatar = ({
  user,
  size = "md",
  showStatus = true,
}: {
  user: User;
  size?: "sm" | "md" | "lg";
  showStatus?: boolean;
}) => {
  const sizeClasses = {
    sm: "w-9 h-9 text-xs",
    md: "w-11 h-11 text-sm",
    lg: "w-14 h-14 text-lg",
  };
  return (
    <div className="relative shrink-0">
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold ${getAvatarColor(user.name)}`}
      >
        {getInitials(user.name)}
      </div>
      {showStatus && (
        <OnlineDot
          isOnline={user.isOnline}
          size={size === "sm" ? "sm" : "md"}
        />
      )}
    </div>
  );
};

/** Seen / Delivered / Sent status with label */
const MessageStatusBadge = ({
  status,
  showLabel = false,
  isOwn = false,
}: {
  status: Message["status"];
  showLabel?: boolean;
  isOwn?: boolean;
}) => {
  const light = isOwn ? "text-primary-content/50" : "text-base-content/40";
  const labelCls = `text-[9px] font-medium ${light}`;
  switch (status) {
    case "read":
      return (
        <span className="inline-flex items-center gap-0.5">
          <span className="relative flex items-center text-primary">
            <FiCheck className="w-3 h-3" />
            <FiCheck className="w-3 h-3 -ml-1.5" />
          </span>
          {showLabel && <span className={labelCls}>Seen</span>}
        </span>
      );
    case "delivered":
      return (
        <span className="inline-flex items-center gap-0.5">
          <span className={`relative flex items-center ${light}`}>
            <FiCheck className="w-3 h-3" />
            <FiCheck className="w-3 h-3 -ml-1.5" />
          </span>
          {showLabel && <span className={labelCls}>Delivered</span>}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-0.5">
          <FiClock className={`w-3 h-3 ${light}`} />
          {showLabel && <span className={labelCls}>Sent</span>}
        </span>
      );
  }
};

/** Typing indicator bubble */
const TypingIndicator = ({ name }: { name: string }) => (
  <div className="flex items-end gap-2">
    <div className="w-8 shrink-0" />
    <div className="bg-base-100 border border-base-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-xs">
      <div className="flex items-center gap-1.5">
        <div className="flex gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-base-content/40 animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-base-content/40 animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-base-content/40 animate-bounce [animation-delay:300ms]" />
        </div>
        <span className="text-[10px] text-base-content/35 ml-1">
          {name.split(" ")[0]} is typing
        </span>
      </div>
    </div>
  </div>
);

// ─── Filter Tabs ──────────────────────────────────────────────────────────────
type ConvoFilter = "all" | "unread" | "pinned";

/** Group avatar: stacked circles */
const GroupAvatar = ({
  users,
  size = "md",
}: {
  users: User[];
  size?: "sm" | "md";
}) => {
  const s = size === "sm" ? "w-5 h-5 text-[8px]" : "w-7 h-7 text-[10px]";
  const outer = size === "sm" ? "w-9 h-9" : "w-11 h-11";
  const show = users.slice(0, 3);
  return (
    <div className={`${outer} relative shrink-0`}>
      {show.map((u, i) => (
        <div
          key={u.id}
          className={`${s} rounded-full flex items-center justify-center font-bold border-2 border-base-100 absolute ${getAvatarColor(u.name)}`}
          style={{
            top: i === 0 ? 0 : undefined,
            bottom: i !== 0 ? 0 : undefined,
            left: i === 0 ? 0 : i === 1 ? "40%" : undefined,
            right: i === 2 ? 0 : undefined,
          }}
        >
          {getInitials(u.name)}
        </div>
      ))}
      {users.length > 3 && (
        <div
          className={`${s} rounded-full flex items-center justify-center font-bold border-2 border-base-100 absolute bottom-0 right-0 bg-base-300 text-base-content/60`}
        >
          +{users.length - 3}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const Messages: React.FC = () => {
  const session = useSession();
  const statusPopup = usePopup();
  const currentUserId = session.data?.user?.id ?? "";
  const viewerId = currentUserId || CURRENT_USER_ID;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<ConvoFilter>("all");
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const [composeSearch, setComposeSearch] = useState("");
  const [attachments, setAttachments] = useState<
    { name: string; type: "image" | "file"; size: string }[]
  >([]);
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [unsendConfirm, setUnsendConfirm] = useState<string | null>(null);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [showGroupCompose, setShowGroupCompose] = useState(false);
  const [groupMembers, setGroupMembers] = useState<User[]>([]);
  const [groupName, setGroupName] = useState("");
  const [onlineScrollOffset, setOnlineScrollOffset] = useState(0);
  const [hoveredConvo, setHoveredConvo] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onlineStripRef = useRef<HTMLDivElement>(null);
  const activeChatId = useMemo(() => {
    if (!activeId) return null;
    const numeric = Number(activeId);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }, [activeId]);
  const { messages: backendMessages, sendMessage } = useMessaging(
    activeChatId ?? 0,
    Boolean(activeChatId),
  );
  const activeConvo = conversations.find((c) => c.id === activeId) ?? null;

  const mapChatToConversation = useCallback(
    (chat: ChatData): Conversation => {
      const name = chat.name || chat.email || "Unknown";
      const latest = chat.latestMessage;
      const latestText = latest
        ? typeof latest.content === "string"
          ? latest.content
          : "[binary message]"
        : "No messages yet";
      const latestTimestamp = latest?.createdAt
        ? new Date(latest.createdAt).toISOString()
        : new Date().toISOString();
      const participants: User[] = (chat.members ?? []).map((member) => ({
        id: member.id,
        name: member.name,
        role: "user",
        avatar: member.image ?? undefined,
        isOnline: false,
      }));
      const fallbackParticipant = participants.find(
        (member) => member.id !== viewerId,
      );

      return {
        id: String(chat.id),
        participant: fallbackParticipant ??
          participants[0] ?? {
            id: chat.email || String(chat.id),
            name,
            role: "user",
            avatar: chat.src ?? undefined,
            isOnline: false,
          },
        participants: chat.type === "GROUP" ? participants : undefined,
        isGroup: chat.type === "GROUP",
        groupName: chat.type === "GROUP" ? name : undefined,
        messages: [],
        lastMessage: {
          id: String(latest?.id ?? `chat-${chat.id}-latest`),
          senderId: latest?.userId ?? "",
          text: latestText,
          timestamp: latestTimestamp,
          status: latest?.userId === viewerId ? "sent" : "delivered",
          type: "text",
        },
        unreadCount: 0,
        isPinned: false,
      };
    },
    [viewerId],
  );

  const mapBackendMessage = useCallback(
    (message: NetworkMessage): Message => {
      const text =
        typeof message.content === "string"
          ? message.content
          : "[binary message]";
      return {
        id: String(message.id),
        senderId: message.userId,
        text,
        timestamp: new Date(message.createdAt).toISOString(),
        status: message.userId === viewerId ? "sent" : "delivered",
        type: "text",
      };
    },
    [viewerId],
  );

  const loadChats = useCallback(async () => {
    const result = await getChats();
    if (!result.success) {
      statusPopup.showError(result.error || "Failed to load chats");
      return;
    }
    const mapped = result.result.map(mapChatToConversation);
    setConversations(mapped);
    if (mapped.length > 0) {
      setActiveId((prev) => prev ?? mapped[0].id);
    }
  }, [mapChatToConversation, statusPopup]);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  useEffect(() => {
    if (!activeId || !activeChatId) return;
    const mappedMessages = backendMessages.map(mapBackendMessage);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? {
              ...c,
              messages: mappedMessages,
              lastMessage:
                mappedMessages[mappedMessages.length - 1] ?? c.lastMessage,
            }
          : c,
      ),
    );
  }, [activeChatId, activeId, backendMessages, mapBackendMessage]);

  // scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConvo?.messages.length, activeId]);

  // focus input
  useEffect(() => {
    if (activeId) inputRef.current?.focus();
  }, [activeId]);

  // ── Filtered list ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = conversations;
    if (filter === "unread") list = list.filter((c) => c.unreadCount > 0);
    if (filter === "pinned") list = list.filter((c) => c.isPinned);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.participant.name.toLowerCase().includes(q) ||
          c.lastMessage.text.toLowerCase().includes(q),
      );
    }
    // pinned first, then by last message time
    return list.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return (
        new Date(b.lastMessage.timestamp).getTime() -
        new Date(a.lastMessage.timestamp).getTime()
      );
    });
  }, [conversations, filter, search]);

  // ── Send message ────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!activeChatId) {
      statusPopup.showWarning("Select a conversation first.");
      return;
    }
    if (attachments.length > 0) {
      statusPopup.showWarning("Attachments are not supported yet.");
      return;
    }
    if (!input.trim()) return;

    try {
      await sendMessage(input.trim());
      setInput("");
      setAttachments([]);
    } catch {
      statusPopup.showError("Failed to send message.");
    }
  }, [activeChatId, attachments.length, input, sendMessage, statusPopup]);

  // ── Select conversation ─────────────────────────────────────────────────
  const selectConvo = useCallback((id: string) => {
    setActiveId(id);
    setShowMobileChat(true);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)),
    );
  }, []);

  // ── Pin message ─────────────────────────────────────────────────────────
  const togglePinMessage = useCallback(
    (msgId: string) => {
      if (!activeId) return;
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === msgId ? { ...m, isPinned: !m.isPinned } : m,
                ),
              }
            : c,
        ),
      );
    },
    [activeId],
  );

  // ── Delete message ──────────────────────────────────────────────────────
  const requestUnsend = useCallback((msgId: string) => {
    setUnsendConfirm(msgId);
  }, []);

  const executeUnsend = useCallback(() => {
    if (!unsendConfirm || !activeId) return;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeId) return c;
        const updated = c.messages.map((m) =>
          m.id === unsendConfirm
            ? { ...m, isDeleted: true, text: "You unsent a message" }
            : m,
        );
        return {
          ...c,
          messages: updated,
          lastMessage: updated[updated.length - 1],
        };
      }),
    );
    setUnsendConfirm(null);
  }, [unsendConfirm, activeId]);

  // ── Pin / unpin conversation ────────────────────────────────────────────
  const toggleConvoPinned = useCallback((convoId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === convoId ? { ...c, isPinned: !c.isPinned } : c)),
    );
  }, []);

  // ── Mock attach file ────────────────────────────────────────────────────
  const handleFileAttach = useCallback(() => {
    setAttachments((prev) => [
      ...prev,
      {
        name: `Document_${Date.now().toString().slice(-4)}.pdf`,
        type: "file" as const,
        size: "1.2 MB",
      },
    ]);
  }, []);

  const handleImageAttach = useCallback(() => {
    setAttachments((prev) => [
      ...prev,
      {
        name: `Photo_${Date.now().toString().slice(-4)}.jpg`,
        type: "image" as const,
        size: "856 KB",
      },
    ]);
  }, []);

  const removeAttachment = useCallback((idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const availableUsers = useMemo(() => {
    const unique = new Map<string, User>();
    conversations.forEach((conversation) => {
      const entries = conversation.participants?.length
        ? conversation.participants
        : [conversation.participant];
      entries.forEach((entry) => {
        if (!entry || entry.id === viewerId) return;
        unique.set(entry.id, entry);
      });
    });
    return Array.from(unique.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [conversations, viewerId]);

  // ── Group chat creation ─────────────────────────────────────────────────
  const toggleGroupMember = useCallback((user: User) => {
    setGroupMembers((prev) =>
      prev.find((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user],
    );
  }, []);
  const createGroupChat = useCallback(async () => {
    if (groupMembers.length < 2) {
      statusPopup.showWarning("Select at least 2 members.");
      return;
    }
    const name =
      groupName.trim() ||
      groupMembers.map((u) => u.name.split(" ")[0]).join(", ");
    const memberIds = groupMembers.map((member) => member.id);
    const result = await createGroupChatAction(name, memberIds);
    if (!result.success) {
      statusPopup.showError(result.error || "Failed to create group chat");
      return;
    }
    setShowGroupCompose(false);
    setGroupMembers([]);
    setGroupName("");
    setComposeSearch("");
    await loadChats();
    setActiveId(String(result.result));
  }, [groupMembers, groupName, loadChats, statusPopup]);

  // ── Online users scroll ─────────────────────────────────────────────────
  const onlineUsers = useMemo(() => mockUsers.filter((u) => u.isOnline), []);
  const ONLINE_VISIBLE = 4;
  const canScrollOnlineLeft = onlineScrollOffset > 0;
  const canScrollOnlineRight =
    onlineScrollOffset + ONLINE_VISIBLE < onlineUsers.length;
  const visibleOnlineUsers = onlineUsers.slice(
    onlineScrollOffset,
    onlineScrollOffset + ONLINE_VISIBLE,
  );

  // ── Group messages by date ─────────────────────────────────────────────
  const groupedMessages = useMemo(() => {
    if (!activeConvo) return [];
    const groups: { date: string; messages: Message[] }[] = [];
    activeConvo.messages.forEach((msg) => {
      const dateStr = new Date(msg.timestamp).toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.date === dateStr) {
        lastGroup.messages.push(msg);
      } else {
        groups.push({ date: dateStr, messages: [msg] });
      }
    });
    return groups;
  }, [activeConvo]);

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div
      className="h-[calc(100vh-2rem)] flex flex-col"
      style={{ padding: "var(--space-page-y) var(--space-page-x)" }}
    >
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl lg:text-4xl font-bold text-base-content tracking-tight">
            Messages
          </h1>
          {totalUnread > 0 && (
            <span className="badge badge-primary badge-sm font-bold">
              {totalUnread} new
            </span>
          )}
        </div>
        <p className="mt-1 text-base text-muted">
          Communicate with your team and clients
        </p>
      </div>

      {/* ── Main Chat Container ──────────────────────────────────────────── */}
      <div className="flex-1 flex rounded-2xl border border-base-200 bg-base-100 shadow-lg overflow-hidden min-h-0">
        {/* ════════════════════════════════════════════════════════════════ */}
        {/* LEFT PANEL — Conversation List                                  */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <aside
          className={[
            "w-full md:w-85 lg:w-95 shrink-0 border-r border-base-200 flex flex-col bg-base-100",
            showMobileChat ? "hidden md:flex" : "flex",
          ].join(" ")}
        >
          {/* Search + New Chat */}
          <div className="px-4 pt-4 pb-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input input-bordered input-sm w-full pl-9 rounded-lg bg-base-200/50 focus:bg-base-100 transition-colors"
                />
              </div>
              <button
                className="btn btn-primary btn-sm btn-square rounded-lg"
                title="Create group"
                onClick={() => setShowGroupCompose(true)}
              >
                <FiUsers className="w-4 h-4" />
              </button>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 bg-base-200/60 rounded-lg p-0.5">
              {(["all", "unread", "pinned"] as ConvoFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={[
                    "flex-1 text-xs font-semibold py-1.5 rounded-md transition-all duration-150 capitalize",
                    filter === f
                      ? "bg-base-100 text-base-content shadow-sm"
                      : "text-base-content/50 hover:text-base-content/70",
                  ].join(" ")}
                >
                  {f}
                  {f === "unread" && totalUnread > 0 && (
                    <span className="ml-1 text-primary">({totalUnread})</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Online users strip */}
          <div className="px-4 py-2 border-b border-base-200">
            <p className="text-[11px] font-bold text-base-content/40 uppercase tracking-wider mb-2">
              Online Now
              <span className="text-base-content/25 ml-1">
                ({onlineUsers.length})
              </span>
            </p>
            <div className="flex items-center gap-1">
              {/* Left arrow */}
              <button
                onClick={() =>
                  setOnlineScrollOffset((p) => Math.max(0, p - ONLINE_VISIBLE))
                }
                disabled={!canScrollOnlineLeft}
                className={`btn btn-ghost btn-xs btn-circle shrink-0 ${canScrollOnlineLeft ? "text-base-content/50 hover:text-primary" : "text-base-content/15 cursor-default"}`}
              >
                <FiChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div
                ref={onlineStripRef}
                className="flex gap-2 flex-1 justify-center overflow-hidden"
              >
                <AnimatePresence mode="popLayout">
                  {visibleOnlineUsers.map((u) => (
                    <motion.button
                      key={u.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => {
                        const c = conversations.find(
                          (cv) => cv.participant.id === u.id,
                        );
                        if (c) selectConvo(c.id);
                      }}
                      className="flex flex-col items-center gap-1 min-w-13 group"
                      title={u.name}
                    >
                      <UserAvatar user={u} size="sm" />
                      <span className="text-[10px] text-base-content/60 group-hover:text-base-content truncate w-12 text-center transition-colors">
                        {u.name.split(" ")[0]}
                      </span>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>

              {/* Right arrow */}
              <button
                onClick={() =>
                  setOnlineScrollOffset((p) =>
                    Math.min(
                      onlineUsers.length - ONLINE_VISIBLE,
                      p + ONLINE_VISIBLE,
                    ),
                  )
                }
                disabled={!canScrollOnlineRight}
                className={`btn btn-ghost btn-xs btn-circle shrink-0 ${canScrollOnlineRight ? "text-base-content/50 hover:text-primary" : "text-base-content/15 cursor-default"}`}
              >
                <FiChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-base-content/30 px-6">
                <FiSearch className="w-10 h-10 mb-3" />
                <p className="text-sm font-medium">No conversations found</p>
              </div>
            ) : (
              filtered.map((convo) => {
                const isActive = convo.id === activeId;
                const isOwn = convo.lastMessage.senderId === viewerId;
                const badge = getRoleBadge(convo.participant.role);
                const isHovered = hoveredConvo === convo.id;
                return (
                  <div
                    key={convo.id}
                    className="relative"
                    onMouseEnter={() => setHoveredConvo(convo.id)}
                    onMouseLeave={() => setHoveredConvo(null)}
                  >
                    <button
                      onClick={() => selectConvo(convo.id)}
                      className={[
                        "w-full flex items-start gap-3 px-4 py-3 text-left transition-all duration-100 border-b border-base-200/60 last:border-0",
                        isActive
                          ? "bg-primary/8 border-l-[3px] border-l-primary"
                          : "hover:bg-base-200/50 border-l-[3px] border-l-transparent",
                      ].join(" ")}
                    >
                      {convo.isGroup && convo.participants ? (
                        <GroupAvatar users={convo.participants} />
                      ) : (
                        <UserAvatar user={convo.participant} size="md" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <div className="flex items-center gap-2 min-w-0">
                            {convo.isGroup && (
                              <FiUsers className="w-3 h-3 text-base-content/40 shrink-0" />
                            )}
                            <span
                              className={`text-sm truncate ${
                                convo.unreadCount > 0
                                  ? "font-bold text-base-content"
                                  : "font-semibold text-base-content/90"
                              }`}
                            >
                              {convo.isGroup
                                ? convo.groupName
                                : convo.participant.name}
                            </span>
                            {!convo.isGroup && (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${badge.cls}`}
                              >
                                {badge.label}
                              </span>
                            )}
                            {convo.isPinned && (
                              <BsPinFill className="w-2.5 h-2.5 text-warning shrink-0" />
                            )}
                          </div>
                          <span className="text-[11px] text-base-content/40 shrink-0 tabular-nums">
                            {formatTime(convo.lastMessage.timestamp)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isOwn && (
                            <span className="shrink-0">
                              <MessageStatusBadge
                                status={convo.lastMessage.status}
                              />
                            </span>
                          )}
                          <p
                            className={`text-xs truncate ${
                              convo.unreadCount > 0
                                ? "text-base-content/80 font-medium"
                                : "text-base-content/50"
                            }`}
                          >
                            {isOwn && "You: "}
                            {convo.isTyping
                              ? "Typing..."
                              : convo.lastMessage.type === "image"
                                ? "📷 Photo"
                                : convo.lastMessage.type === "file"
                                  ? `📎 ${convo.lastMessage.fileName ?? "File"}`
                                  : convo.lastMessage.text}
                          </p>
                          {convo.unreadCount > 0 && (
                            <span className="ml-auto shrink-0 w-5 h-5 rounded-full bg-primary text-primary-content text-[10px] font-bold flex items-center justify-center">
                              {convo.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                    {/* Pin conversation toggle on hover */}
                    {isHovered && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleConvoPinned(convo.id);
                        }}
                        className={`absolute top-2 right-2 btn btn-ghost btn-xs btn-square rounded-md z-10 ${convo.isPinned ? "text-warning" : "text-base-content/30 hover:text-warning"}`}
                        title={
                          convo.isPinned
                            ? "Unpin conversation"
                            : "Pin conversation"
                        }
                      >
                        {convo.isPinned ? (
                          <BsPinFill className="w-3 h-3" />
                        ) : (
                          <BsPin className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* RIGHT PANEL — Active Chat                                       */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <main
          className={[
            "flex-1 flex flex-col min-w-0",
            showMobileChat ? "flex" : "hidden md:flex",
          ].join(" ")}
        >
          {!activeConvo ? (
            /* ── Empty State ──────────────────────────────────────────── */
            <div className="flex-1 flex flex-col items-center justify-center text-base-content/30 px-6">
              <div className="w-20 h-20 rounded-3xl bg-primary/8 flex items-center justify-center mb-5">
                <FiSend className="w-8 h-8 text-primary/40" />
              </div>
              <h3 className="text-xl font-bold text-base-content/50 mb-2">
                Select a conversation
              </h3>
              <p className="text-sm text-base-content/40 text-center max-w-xs">
                Choose a conversation from the list or start a new one to begin
                messaging.
              </p>
            </div>
          ) : (
            <>
              {/* ── Chat Header ──────────────────────────────────────── */}
              <div className="shrink-0 px-5 py-3 border-b border-base-200 flex items-center gap-3 bg-base-100 z-10">
                {/* Back button (mobile) */}
                <button
                  className="btn btn-ghost btn-sm btn-square md:hidden"
                  onClick={() => setShowMobileChat(false)}
                >
                  <FiChevronLeft className="w-5 h-5" />
                </button>

                {activeConvo.isGroup && activeConvo.participants ? (
                  <GroupAvatar users={activeConvo.participants} />
                ) : (
                  <UserAvatar user={activeConvo.participant} size="md" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-base-content truncate">
                    {activeConvo.isGroup
                      ? activeConvo.groupName
                      : activeConvo.participant.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    {activeConvo.isGroup ? (
                      <span className="text-xs text-base-content/50 flex items-center gap-1">
                        <FiUsers className="w-3 h-3" />
                        {activeConvo.participants?.length ?? 0} members
                      </span>
                    ) : (
                      <>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${getRoleBadge(activeConvo.participant.role).cls}`}
                        >
                          {getRoleBadge(activeConvo.participant.role).label}
                        </span>
                        {activeConvo.participant.isOnline ? (
                          <span className="text-xs text-success font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                            Active now
                          </span>
                        ) : activeConvo.isTyping ? (
                          <span className="text-xs text-primary font-medium">
                            Typing...
                          </span>
                        ) : (
                          <span className="text-xs text-base-content/40">
                            {formatLastSeen(activeConvo.participant.lastSeen)}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button className="btn btn-ghost btn-sm btn-square rounded-lg text-base-content/50 hover:text-primary">
                    <FiPhone className="w-4 h-4" />
                  </button>
                  <button className="btn btn-ghost btn-sm btn-square rounded-lg text-base-content/50 hover:text-primary">
                    <FiVideo className="w-4 h-4" />
                  </button>
                  <button className="btn btn-ghost btn-sm btn-square rounded-lg text-base-content/50 hover:text-primary">
                    <FiMoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* ── Pinned Messages Bar ──────────────────────────────── */}
              {(() => {
                const pinned = activeConvo.messages.filter(
                  (m) => m.isPinned && !m.isDeleted,
                );
                if (pinned.length === 0) return null;
                return (
                  <div className="shrink-0 border-b border-base-200">
                    {/* Clickable summary bar */}
                    <button
                      onClick={() => setShowPinnedPanel((p) => !p)}
                      className="w-full px-4 py-2 bg-warning/5 flex items-center gap-2 hover:bg-warning/10 transition-colors text-left"
                    >
                      <BsPinFill className="w-3.5 h-3.5 text-warning shrink-0" />
                      <span className="text-xs text-base-content/70 truncate flex-1">
                        <span className="font-semibold text-warning">
                          {pinned.length} pinned
                        </span>
                        {" — "}
                        {pinned[pinned.length - 1].text || "Media"}
                      </span>
                      <FiChevronRight
                        className={`w-3.5 h-3.5 text-base-content/30 transition-transform duration-200 ${showPinnedPanel ? "rotate-90" : ""}`}
                      />
                    </button>

                    {/* Expandable pinned messages list */}
                    <AnimatePresence>
                      {showPinnedPanel && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="max-h-48 overflow-y-auto bg-warning/3 divide-y divide-base-200/60">
                            {pinned.map((msg) => {
                              const sender =
                                msg.senderId === viewerId
                                  ? "You"
                                  : activeConvo.isGroup
                                    ? (activeConvo.participants
                                        ?.find((u) => u.id === msg.senderId)
                                        ?.name.split(" ")[0] ??
                                      activeConvo.participant.name.split(
                                        " ",
                                      )[0])
                                    : activeConvo.participant.name.split(
                                        " ",
                                      )[0];
                              return (
                                <div
                                  key={msg.id}
                                  className="px-4 py-2.5 flex items-start gap-3 hover:bg-warning/5"
                                >
                                  <BsPinFill className="w-3 h-3 text-warning shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="text-[10px] font-bold text-base-content/60">
                                        {sender}
                                      </span>
                                      <span className="text-[10px] text-base-content/30 tabular-nums">
                                        {formatFullTime(msg.timestamp)}
                                      </span>
                                    </div>
                                    <p className="text-xs text-base-content/70 truncate">
                                      {msg.type === "image"
                                        ? "📷 Photo"
                                        : msg.type === "file"
                                          ? `📎 ${msg.fileName}`
                                          : msg.text}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => togglePinMessage(msg.id)}
                                    className="btn btn-ghost btn-xs btn-square rounded-md text-base-content/30 hover:text-error shrink-0"
                                    title="Unpin"
                                  >
                                    <FiX className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })()}

              {/* ── Messages Area ────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 bg-base-200/30">
                {groupedMessages.map((group) => (
                  <div key={group.date}>
                    {/* Date divider */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex-1 h-px bg-base-300" />
                      <span className="text-[11px] font-semibold text-base-content/35 uppercase tracking-wider px-1">
                        {group.date}
                      </span>
                      <div className="flex-1 h-px bg-base-300" />
                    </div>

                    {/* Messages */}
                    <div className="space-y-1.5">
                      {group.messages.map((msg, i) => {
                        const isOwn = msg.senderId === viewerId;
                        const showAvatar =
                          !isOwn &&
                          (i === 0 ||
                            group.messages[i - 1].senderId !== msg.senderId);
                        const isLast =
                          i === group.messages.length - 1 ||
                          group.messages[i + 1]?.senderId !== msg.senderId;

                        return (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.15 }}
                            className={`flex items-end gap-2 group/msg ${isOwn ? "justify-end" : "justify-start"}`}
                            onMouseEnter={() => setHoveredMsg(msg.id)}
                            onMouseLeave={() => setHoveredMsg(null)}
                          >
                            {/* Avatar placeholder for alignment */}
                            {!isOwn && (
                              <div className="w-8 shrink-0">
                                {showAvatar && (
                                  <UserAvatar
                                    user={activeConvo.participant}
                                    size="sm"
                                    showStatus={false}
                                  />
                                )}
                              </div>
                            )}

                            {/* Hover actions (own messages: left side) */}
                            {isOwn &&
                              hoveredMsg === msg.id &&
                              !msg.isDeleted && (
                                <div className="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity pb-1">
                                  <button
                                    onClick={() => togglePinMessage(msg.id)}
                                    className={`btn btn-ghost btn-xs btn-square rounded-md ${msg.isPinned ? "text-warning" : "text-base-content/30 hover:text-warning"}`}
                                    title={msg.isPinned ? "Unpin" : "Pin"}
                                  >
                                    <BsPin className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => requestUnsend(msg.id)}
                                    className="btn btn-ghost btn-xs btn-square rounded-md text-base-content/30 hover:text-error"
                                    title="Unsend"
                                  >
                                    <FiTrash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}

                            <div
                              className={[
                                "max-w-[70%] text-sm leading-relaxed relative",
                                msg.isDeleted
                                  ? "px-4 py-2.5 italic opacity-50 bg-base-200 text-base-content/50 rounded-2xl border border-dashed border-base-300"
                                  : msg.type === "image"
                                    ? "rounded-2xl overflow-hidden shadow-sm"
                                    : [
                                        "px-4 py-2.5",
                                        isOwn
                                          ? "bg-primary text-primary-content rounded-2xl rounded-br-md shadow-sm"
                                          : "bg-base-100 text-base-content border border-base-200 rounded-2xl rounded-bl-md shadow-xs",
                                      ].join(" "),
                                msg.isPinned && !msg.isDeleted
                                  ? "ring-1 ring-warning/40"
                                  : "",
                              ].join(" ")}
                            >
                              {/* Pinned indicator */}
                              {msg.isPinned && !msg.isDeleted && (
                                <div className="absolute -top-2 -right-2">
                                  <BsPinFill className="w-3 h-3 text-warning" />
                                </div>
                              )}

                              {/* Deleted message */}
                              {msg.isDeleted ? (
                                <p className="flex items-center gap-1.5">
                                  <FiTrash2 className="w-3 h-3" />
                                  You unsent a message
                                </p>
                              ) : msg.type === "image" ? (
                                /* Image message */
                                <div>
                                  <div
                                    className="w-64 h-48 bg-base-200 flex items-center justify-center relative cursor-pointer group/img"
                                    onClick={() =>
                                      setLightboxImg(msg.imageUrl ?? null)
                                    }
                                  >
                                    <Image
                                      src={msg.imageUrl ?? ""}
                                      alt="Shared"
                                      fill
                                      className="object-cover"
                                      unoptimized
                                    />
                                    {/* Zoom overlay */}
                                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
                                      <FiMaximize2 className="w-6 h-6 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-lg" />
                                    </div>
                                  </div>
                                  <div
                                    className={`px-3 py-1.5 ${
                                      isOwn
                                        ? "bg-primary text-primary-content"
                                        : "bg-base-100 border-t border-base-200"
                                    }`}
                                  >
                                    <div className="flex items-center gap-1">
                                      <span
                                        className={`text-[10px] tabular-nums ${
                                          isOwn
                                            ? "text-primary-content/60"
                                            : "text-base-content/35"
                                        }`}
                                      >
                                        {formatFullTime(msg.timestamp)}
                                      </span>
                                      {isOwn && isLast && (
                                        <MessageStatusBadge
                                          status={msg.status}
                                          isOwn
                                          showLabel
                                        />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : msg.type === "file" ? (
                                /* File message */
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                                      isOwn
                                        ? "bg-primary-content/15"
                                        : "bg-primary/10"
                                    }`}
                                  >
                                    <FiFile
                                      className={`w-5 h-5 ${isOwn ? "text-primary-content" : "text-primary"}`}
                                    />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p
                                      className={`text-xs font-semibold truncate ${
                                        isOwn
                                          ? "text-primary-content"
                                          : "text-base-content"
                                      }`}
                                    >
                                      {msg.fileName}
                                    </p>
                                    <p
                                      className={`text-[10px] ${
                                        isOwn
                                          ? "text-primary-content/60"
                                          : "text-base-content/40"
                                      }`}
                                    >
                                      {msg.fileSize}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span
                                      className={`text-[10px] tabular-nums ${
                                        isOwn
                                          ? "text-primary-content/60"
                                          : "text-base-content/35"
                                      }`}
                                    >
                                      {formatFullTime(msg.timestamp)}
                                    </span>
                                    {isOwn && isLast && (
                                      <MessageStatusBadge
                                        status={msg.status}
                                        isOwn
                                        showLabel
                                      />
                                    )}
                                  </div>
                                </div>
                              ) : (
                                /* Text message */
                                <>
                                  <p>{msg.text}</p>
                                  <div
                                    className={`flex items-center gap-1 mt-1.5 ${
                                      isOwn ? "justify-end" : "justify-start"
                                    }`}
                                  >
                                    <span
                                      className={`text-[10px] tabular-nums ${
                                        isOwn
                                          ? "text-primary-content/60"
                                          : "text-base-content/35"
                                      }`}
                                    >
                                      {formatFullTime(msg.timestamp)}
                                    </span>
                                    {isOwn && isLast && (
                                      <MessageStatusBadge
                                        status={msg.status}
                                        isOwn
                                        showLabel
                                      />
                                    )}
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Hover actions (other's messages: right side) */}
                            {!isOwn &&
                              hoveredMsg === msg.id &&
                              !msg.isDeleted && (
                                <div className="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity pb-1">
                                  <button
                                    onClick={() => togglePinMessage(msg.id)}
                                    className={`btn btn-ghost btn-xs btn-square rounded-md ${msg.isPinned ? "text-warning" : "text-base-content/30 hover:text-warning"}`}
                                    title={msg.isPinned ? "Unpin" : "Pin"}
                                  >
                                    <BsPin className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {/* Typing indicator */}
                {activeConvo.isTyping && (
                  <div className="flex items-end gap-2 ml-10">
                    <TypingIndicator
                      name={activeConvo.participant.name.split(" ")[0]}
                    />
                  </div>
                )}

                {/* Seen receipt */}
                {(() => {
                  const lastOwn = [...activeConvo.messages]
                    .reverse()
                    .find((m) => m.senderId === viewerId);
                  if (!lastOwn || lastOwn.status !== "read") return null;
                  return (
                    <div className="flex justify-end pr-1">
                      <span className="text-[10px] text-base-content/40 flex items-center gap-1">
                        Seen {formatFullTime(lastOwn.timestamp)}
                      </span>
                    </div>
                  );
                })()}

                <div ref={messagesEndRef} />
              </div>

              {/* ── Message Input ────────────────────────────────────── */}
              <div className="shrink-0 border-t border-base-200 bg-base-100">
                {/* Attachment preview bar */}
                <AnimatePresence>
                  {attachments.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-4 pt-2 flex gap-2 flex-wrap overflow-hidden"
                    >
                      {attachments.map((att, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 bg-base-200 rounded-lg px-3 py-1.5 text-xs"
                        >
                          {att.type === "image" ? (
                            <FiImage className="w-3.5 h-3.5 text-primary" />
                          ) : (
                            <FiFile className="w-3.5 h-3.5 text-primary" />
                          )}
                          <span className="text-base-content/70 max-w-32 truncate">
                            {att.name}
                          </span>
                          <span className="text-base-content/40">
                            {att.size}
                          </span>
                          <button
                            onClick={() => removeAttachment(idx)}
                            className="btn btn-ghost btn-xs btn-circle text-base-content/40 hover:text-error"
                          >
                            <FiX className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="px-4 py-3 flex items-end gap-2">
                  {/* Attachment buttons */}
                  <div className="flex items-center gap-0.5 pb-1">
                    <button
                      onClick={handleFileAttach}
                      className="btn btn-ghost btn-xs btn-square rounded-lg text-base-content/40 hover:text-primary"
                      title="Attach file"
                    >
                      <FiPaperclip className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleImageAttach}
                      className="btn btn-ghost btn-xs btn-square rounded-lg text-base-content/40 hover:text-primary"
                      title="Send image"
                    >
                      <FiImage className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Input */}
                  <div className="flex-1 relative">
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Type a message..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      className="input input-bordered input-sm w-full rounded-full bg-base-200/50 focus:bg-base-100 pr-10 transition-colors"
                    />
                    <button className="absolute right-1.5 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle text-base-content/40 hover:text-primary">
                      <FiSmile className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Send button */}
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() && attachments.length === 0}
                    className={[
                      "btn btn-sm btn-circle shrink-0 transition-all duration-150",
                      input.trim() || attachments.length > 0
                        ? "btn-primary shadow-sm hover:shadow-md"
                        : "btn-ghost text-base-content/30",
                    ].join(" ")}
                  >
                    <FiSend className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* ── Unsend Confirm Modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {unsendConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setUnsendConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-base-200"
            >
              <div className="px-6 pt-6 pb-4 text-center">
                <div className="w-14 h-14 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
                  <FiAlertTriangle className="w-7 h-7 text-error" />
                </div>
                <h3 className="text-lg font-bold text-base-content mb-2">
                  Unsend Message?
                </h3>
                <p className="text-sm text-base-content/60">
                  This will remove the message for everyone in the conversation.
                  This action cannot be undone.
                </p>
              </div>
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => setUnsendConfirm(null)}
                  className="btn btn-ghost btn-sm flex-1 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={executeUnsend}
                  className="btn btn-error btn-sm flex-1 rounded-lg text-white"
                >
                  <FiTrash2 className="w-3.5 h-3.5" />
                  Unsend
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Image Lightbox Modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {lightboxImg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={() => setLightboxImg(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-3xl max-h-[80vh] w-full"
            >
              <button
                onClick={() => setLightboxImg(null)}
                className="absolute -top-10 right-0 btn btn-ghost btn-sm btn-circle text-white/70 hover:text-white hover:bg-white/10"
              >
                <FiX className="w-5 h-5" />
              </button>
              <div className="relative w-full h-[70vh] rounded-xl overflow-hidden bg-base-200/10">
                <Image
                  src={lightboxImg}
                  alt="Image preview"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Create Group Chat Modal ────────────────────────────────────── */}
      <AnimatePresence>
        {showGroupCompose && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => {
              setShowGroupCompose(false);
              setGroupMembers([]);
              setGroupName("");
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-base-200"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-base-200">
                <h3 className="text-lg font-bold text-base-content flex items-center gap-2">
                  <FiUsers className="w-5 h-5 text-primary" />
                  Create Group Chat
                </h3>
                <button
                  onClick={() => {
                    setShowGroupCompose(false);
                    setGroupMembers([]);
                    setGroupName("");
                  }}
                  className="btn btn-ghost btn-sm btn-square rounded-lg"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>

              {/* Group name */}
              <div className="px-5 py-3 border-b border-base-200">
                <input
                  type="text"
                  placeholder="Group name (optional)"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="input input-bordered input-sm w-full rounded-lg"
                />
              </div>

              {/* Selected members chips */}
              {groupMembers.length > 0 && (
                <div className="px-5 pt-3 flex flex-wrap gap-1.5">
                  {groupMembers.map((u) => (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full"
                    >
                      {u.name.split(" ")[0]}
                      <button
                        onClick={() => toggleGroupMember(u)}
                        className="hover:text-error transition-colors"
                      >
                        <FiX className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Search + contact list */}
              <div className="px-5 py-3 border-b border-base-200">
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Add members..."
                    value={composeSearch}
                    onChange={(e) => setComposeSearch(e.target.value)}
                    className="input input-bordered input-sm w-full pl-9 rounded-lg"
                    autoFocus
                  />
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto">
                {availableUsers
                  .filter(
                    (u) =>
                      !composeSearch.trim() ||
                      u.name
                        .toLowerCase()
                        .includes(composeSearch.toLowerCase()),
                  )
                  .map((user) => {
                    const isSelected = groupMembers.some(
                      (m) => m.id === user.id,
                    );
                    const badge = getRoleBadge(user.role);
                    return (
                      <button
                        key={user.id}
                        onClick={() => toggleGroupMember(user)}
                        className={`w-full flex items-center gap-3 px-5 py-3 transition-colors text-left ${isSelected ? "bg-primary/5" : "hover:bg-base-200/50"}`}
                      >
                        <UserAvatar user={user} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-base-content truncate">
                              {user.name}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badge.cls}`}
                            >
                              {badge.label}
                            </span>
                          </div>
                          <p className="text-xs text-base-content/50">
                            {user.isOnline ? (
                              <span className="text-success font-medium flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                                Active now
                              </span>
                            ) : (
                              formatLastSeen(user.lastSeen)
                            )}
                          </p>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? "bg-primary border-primary" : "border-base-300"}`}
                        >
                          {isSelected && (
                            <FiCheck className="w-3 h-3 text-primary-content" />
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>

              {/* Create button */}
              <div className="px-5 py-4 border-t border-base-200">
                <button
                  onClick={createGroupChat}
                  disabled={groupMembers.length < 2}
                  className="btn btn-primary btn-sm w-full rounded-lg gap-2"
                >
                  <FiUsers className="w-4 h-4" />
                  Create Group
                  {groupMembers.length > 0 && (
                    <span className="badge badge-sm badge-primary-content/20">
                      {groupMembers.length} members
                    </span>
                  )}
                </button>
                {groupMembers.length < 2 && groupMembers.length > 0 && (
                  <p className="text-[10px] text-error text-center mt-1.5">
                    Select at least 2 members
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Messages;
