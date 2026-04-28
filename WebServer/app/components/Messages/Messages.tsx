"use client";

import {
  createGroupChat as createGroupChatAction,
  getChatById,
  getChats,
} from "@/app/components/Messages/MessagesActions";
import { useSession } from "@/app/lib/authClient";
import { getFileUrl } from "@/app/lib/socket/handlers/messageFile";
import { useMessaging } from "@/app/lib/socket/hooks/useMessaging";
import {
  ChatData,
  Message,
  RedirectingUI,
  usePopup,
} from "@rtc-database/shared";
import { ChatType, Roles } from "@rtc-database/shared/prisma/browser";
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
  FiDownload,
  FiFile,
  FiImage,
  FiMic,
  FiMoreHorizontal,
  FiMusic,
  FiPaperclip,
  FiPhone,
  FiSearch,
  FiSend,
  FiSmile,
  FiSquare,
  FiTrash2,
  FiUsers,
  FiVideo,
  FiX,
} from "react-icons/fi";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DisplayUser {
  id: string;
  name: string;
  image?: string;
  role?: Roles;
  isOnline?: boolean;
  lastSeen?: string;
}

type GroupedMessages = { date: string; messages: Message[] };

const INLINE_MEDIA_AUTOPLAY_LIMIT = 1;
const ATTACHMENT_PLACEHOLDER_TEXT = "Sent an attachment";

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

const formatRecordingTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

const isAttachmentPlaceholderText = (value: string, hasFile: boolean) =>
  hasFile && value.trim().toLowerCase() === ATTACHMENT_PLACEHOLDER_TEXT;

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

const getRoleBadge = (role?: Roles) => {
  switch (role) {
    case Roles.admin:
      return { label: "Admin", cls: "bg-error/15 text-error" };
    case Roles.criminal:
      return { label: "Criminal Section", cls: "bg-info/15 text-info" };
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
  user: DisplayUser;
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
          isOnline={Boolean(user.isOnline)}
          size={size === "sm" ? "sm" : "md"}
        />
      )}
    </div>
  );
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
  users: DisplayUser[];
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
  const viewerId = currentUserId;

  const [conversations, setConversations] = useState<ChatData[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<ConvoFilter>("all");
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [hoveredMsg, setHoveredMsg] = useState<number | null>(null);
  const [composeSearch, setComposeSearch] = useState("");
  const [attachments, setAttachments] = useState<
    { file: File; name: string; type: "image" | "file"; size: string }[]
  >([]);
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [unsendConfirm, setUnsendConfirm] = useState<number | null>(null);
  const [lightboxGallery, setLightboxGallery] = useState<{
    images: string[];
    index: number;
  } | null>(null);
  const [showGroupCompose, setShowGroupCompose] = useState(false);
  const [groupMembers, setGroupMembers] = useState<DisplayUser[]>([]);
  const [groupName, setGroupName] = useState("");
  const [onlineScrollOffset, setOnlineScrollOffset] = useState(0);
  const [hoveredConvo, setHoveredConvo] = useState<number | null>(null);
  const [pinnedConvoIds, setPinnedConvoIds] = useState<Set<number>>(new Set());
  const [pinnedMessageIdsByChat, setPinnedMessageIdsByChat] = useState<
    Record<number, Set<number>>
  >({});
  const [unsentMessageIdsByChat, setUnsentMessageIdsByChat] = useState<
    Record<number, Set<number>>
  >({});
  const [unreadByChat, setUnreadByChat] = useState<Record<number, number>>({});
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [fileAccessByMessageId, setFileAccessByMessageId] = useState<
    Record<
      number,
      { url: string; isImage: boolean; fileName: string; mimeType: string }
    >
  >({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onlineStripRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeChatId = activeId;
  const { messages: backendMessages, sendMessage } = useMessaging(
    activeChatId ?? 0,
    Boolean(activeChatId),
    getChatById,
  );

  const loadChats = useCallback(async () => {
    const result = await getChats();
    if (!result.success) {
      statusPopup.showError(result.error || "Failed to load chats");
      return;
    }
    setConversations(result.result);
  }, [statusPopup]);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  const activeConvo = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const activeMessages = useMemo(() => {
    if (!activeConvo) return [];
    return backendMessages;
  }, [activeConvo, backendMessages]);

  // scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length, activeId]);

  // focus input
  useEffect(() => {
    if (activeId) inputRef.current?.focus();
  }, [activeId]);

  // ── Filtered list ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...conversations];
    if (filter === "unread")
      list = list.filter((c) => (unreadByChat[c.id] ?? 0) > 0);
    if (filter === "pinned")
      list = list.filter((c) => pinnedConvoIds.has(c.id));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.latestMessage?.content.toLowerCase().includes(q),
      );
    }
    // pinned first, then by latest activity time
    return list.sort((a, b) => {
      const aPinned = pinnedConvoIds.has(a.id);
      const bPinned = pinnedConvoIds.has(b.id);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return (
        new Date(b.latestMessage?.updatedAt ?? 0).getTime() -
        new Date(a.latestMessage?.updatedAt ?? 0).getTime()
      );
    });
  }, [conversations, filter, search, pinnedConvoIds, unreadByChat]);

  // ── Send message ────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!activeChatId) {
      statusPopup.showWarning("Select a conversation first.");
      return;
    }
    if (!input.trim() && attachments.length === 0) return;

    try {
      const trimmed = input.trim();
      if (trimmed) {
        await sendMessage(trimmed);
      }

      for (const attachment of attachments) {
        await sendMessage(ATTACHMENT_PLACEHOLDER_TEXT, attachment.file);
      }

      setInput("");
      setAttachments([]);
    } catch {
      statusPopup.showError("Failed to send message.");
    }
  }, [activeChatId, attachments, input, sendMessage, statusPopup]);

  // ── Select conversation ─────────────────────────────────────────────────
  const selectConvo = useCallback((id: number) => {
    setActiveId(id);
    setShowMobileChat(true);
    setUnreadByChat((prev) => ({ ...prev, [id]: 0 }));
  }, []);

  // ── Pin message ─────────────────────────────────────────────────────────
  const togglePinMessage = useCallback(
    (msgId: number) => {
      if (!activeId) return;
      setPinnedMessageIdsByChat((prev) => {
        const current = prev[activeId]
          ? new Set(prev[activeId])
          : new Set<number>();
        if (current.has(msgId)) current.delete(msgId);
        else current.add(msgId);
        return { ...prev, [activeId]: current };
      });
    },
    [activeId],
  );

  // ── Delete message ──────────────────────────────────────────────────────
  const requestUnsend = useCallback((msgId: number) => {
    setUnsendConfirm(msgId);
  }, []);

  const executeUnsend = useCallback(() => {
    if (!unsendConfirm || !activeId) return;
    setUnsentMessageIdsByChat((prev) => {
      const current = prev[activeId]
        ? new Set(prev[activeId])
        : new Set<number>();
      current.add(unsendConfirm);
      return { ...prev, [activeId]: current };
    });
    setUnsendConfirm(null);
  }, [unsendConfirm, activeId]);

  // ── Pin / unpin conversation ────────────────────────────────────────────
  const toggleConvoPinned = useCallback((convoId: number) => {
    setPinnedConvoIds((prev) => {
      const next = new Set(prev);
      if (next.has(convoId)) next.delete(convoId);
      else next.add(convoId);
      return next;
    });
  }, []);

  // ── Mock attach file ────────────────────────────────────────────────────
  const handleFileAttach = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageAttach = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handlePickedFiles = useCallback(
    (files: FileList | null, preferredKind: "image" | "file") => {
      if (!files?.length) return;
      const next = Array.from(files).map((file) => ({
        file,
        name: file.name,
        type:
          preferredKind === "image" || file.type.startsWith("image/")
            ? ("image" as const)
            : ("file" as const),
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      }));
      setAttachments((prev) => [...prev, ...next]);
    },
    [],
  );

  const removeAttachment = useCallback((idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const stopAudioRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state === "recording") {
      recorder.stop();
    }
  }, []);

  const startAudioRecording = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      statusPopup.showError(
        "Audio recording is not supported in this browser.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstart = () => {
        setIsRecordingAudio(true);
        setRecordingSeconds(0);
        recordingTimerRef.current = setInterval(() => {
          setRecordingSeconds((s) => s + 1);
        }, 1000);
      };

      recorder.onstop = () => {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        const blobType = recorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
        if (audioBlob.size > 0) {
          const extension = blobType.includes("ogg")
            ? "ogg"
            : blobType.includes("mp4") || blobType.includes("m4a")
              ? "m4a"
              : blobType.includes("wav")
                ? "wav"
                : "webm";
          const file = new File(
            [audioBlob],
            `Voice_${Date.now()}.${extension}`,
            { type: blobType },
          );
          setAttachments([
            {
              file,
              name: file.name,
              type: "file",
              size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
            },
          ]);
        }

        stream.getTracks().forEach((track) => track.stop());
        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        setIsRecordingAudio(false);
      };

      recorder.onerror = () => {
        statusPopup.showError("Audio recording failed.");
        stream.getTracks().forEach((track) => track.stop());
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        setIsRecordingAudio(false);
        mediaRecorderRef.current = null;
      };

      recorder.start();
    } catch {
      statusPopup.showError("Microphone permission denied or unavailable.");
    }
  }, [statusPopup]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const availableUsers = useMemo(() => {
    const unique = new Map<string, DisplayUser>();
    conversations.forEach((conversation) => {
      const entries = conversation.members ?? [];
      entries.forEach((entry) => {
        if (!entry || entry.id === viewerId) return;
        unique.set(entry.id, {
          id: entry.id,
          name: entry.name,
          image: entry.image ?? undefined,
        });
      });
    });
    return Array.from(unique.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [conversations, viewerId]);

  // ── Group chat creation ─────────────────────────────────────────────────
  const toggleGroupMember = useCallback((user: DisplayUser) => {
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
    setActiveId(result.result);
  }, [groupMembers, groupName, loadChats, statusPopup]);

  // ── Online users scroll ─────────────────────────────────────────────────
  const onlineUsers: DisplayUser[] = [];
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
    const groups: GroupedMessages[] = [];
    activeMessages.forEach((msg) => {
      const dateStr = new Date(msg.createdAt).toLocaleDateString([], {
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
  }, [activeConvo, activeMessages]);

  const totalUnread = conversations.reduce(
    (s, c) => s + (unreadByChat[c.id] ?? 0),
    0,
  );
  const primaryUserByConvo = useMemo(() => {
    const map: Record<number, DisplayUser> = {};
    conversations.forEach((convo) => {
      const fallbackName = convo.name || convo.email || "Unknown";
      const preferred =
        convo.members?.find((m) => m.id !== viewerId) ?? convo.members?.[0];
      map[convo.id] = {
        id: preferred?.id ?? String(convo.id),
        name: preferred?.name ?? fallbackName,
        image: preferred?.image ?? convo.src,
      };
    });
    return map;
  }, [conversations, viewerId]);

  const isMessagePinned = useCallback(
    (chatId: number, messageId: number) =>
      Boolean(pinnedMessageIdsByChat[chatId]?.has(messageId)),
    [pinnedMessageIdsByChat],
  );

  const isMessageUnsent = useCallback(
    (chatId: number, messageId: number) =>
      Boolean(unsentMessageIdsByChat[chatId]?.has(messageId)),
    [unsentMessageIdsByChat],
  );

  const autoplayMediaMessageIds = useMemo(() => {
    if (!activeConvo) return new Set<number>();
    const mediaMessages = activeMessages.filter((msg) => {
      if (!msg.fileId || isMessageUnsent(activeConvo.id, msg.id)) return false;
      const access = fileAccessByMessageId[msg.id];
      if (!access) return false;
      return (
        access.mimeType.startsWith("video/") ||
        access.mimeType.startsWith("audio/")
      );
    });

    return new Set(
      mediaMessages
        .slice(-INLINE_MEDIA_AUTOPLAY_LIMIT)
        .map((message) => message.id),
    );
  }, [activeConvo, activeMessages, fileAccessByMessageId, isMessageUnsent]);

  useEffect(() => {
    if (!activeConvo) return;
    const candidates = activeMessages.filter(
      (msg) => msg.fileId && !fileAccessByMessageId[msg.id],
    );
    if (candidates.length === 0) return;

    let cancelled = false;
    const load = async () => {
      const fetched = await Promise.all(
        candidates.map(async (msg) => {
          const result = await getFileUrl(msg.id, false);
          if (!result.success) return null;
          return {
            id: msg.id,
            access: {
              url: result.result.url,
              isImage: result.result.isImage,
              fileName: result.result.fileName,
              mimeType: result.result.mimeType,
            },
          };
        }),
      );
      if (cancelled) return;
      setFileAccessByMessageId((prev) => {
        const next = { ...prev };
        fetched.forEach((entry) => {
          if (!entry) return;
          next[entry.id] = entry.access;
        });
        return next;
      });
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [activeConvo, activeMessages, fileAccessByMessageId]);

  if (session.isPending) {
    return <RedirectingUI titleText="Loading messages..." />;
  }

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
                        const c = conversations.find((cv) =>
                          cv.members?.some((m) => m.id === u.id),
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
                const isOwn = convo.latestMessage?.userId === viewerId;
                const isHovered = hoveredConvo === convo.id;
                const isGroup = convo.type === ChatType.GROUP;
                const badge = getRoleBadge();
                const unreadCount = unreadByChat[convo.id] ?? 0;
                const primaryUser = primaryUserByConvo[convo.id] ?? {
                  id: String(convo.id),
                  name: convo.name,
                  image: convo.src,
                };
                const isPinned = pinnedConvoIds.has(convo.id);
                const latestHasFile = Boolean(convo.latestMessage?.fileId);
                const latestContent = convo.latestMessage?.content ?? "";
                const latestText = isAttachmentPlaceholderText(
                  latestContent,
                  latestHasFile,
                )
                  ? "Attachment"
                  : latestContent || "No messages yet";
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
                      {isGroup && convo.members?.length ? (
                        <GroupAvatar
                          users={convo.members.map((m) => ({
                            id: m.id,
                            name: m.name,
                            image: m.image ?? undefined,
                          }))}
                        />
                      ) : (
                        <UserAvatar user={primaryUser} size="md" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <div className="flex items-center gap-2 min-w-0">
                            {isGroup && (
                              <FiUsers className="w-3 h-3 text-base-content/40 shrink-0" />
                            )}
                            <span
                              className={`text-sm truncate ${
                                unreadCount > 0
                                  ? "font-bold text-base-content"
                                  : "font-semibold text-base-content/90"
                              }`}
                            >
                              {convo.name}
                            </span>
                            {!isGroup && (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${badge.cls}`}
                              >
                                {badge.label}
                              </span>
                            )}
                            {isPinned && (
                              <BsPinFill className="w-2.5 h-2.5 text-warning shrink-0" />
                            )}
                          </div>
                          <span className="text-[11px] text-base-content/40 shrink-0 tabular-nums">
                            {convo.latestMessage
                              ? formatTime(
                                  convo.latestMessage.createdAt.toString(),
                                )
                              : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <p
                            className={`text-xs truncate ${
                              unreadCount > 0
                                ? "text-base-content/80 font-medium"
                                : "text-base-content/50"
                            }`}
                          >
                            {isOwn && "You: "}
                            {latestText}
                          </p>
                          {unreadCount > 0 && (
                            <span className="ml-auto shrink-0 w-5 h-5 rounded-full bg-primary text-primary-content text-[10px] font-bold flex items-center justify-center">
                              {unreadCount}
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
                        className={`absolute top-2 right-2 btn btn-ghost btn-xs btn-square rounded-md z-10 ${isPinned ? "text-warning" : "text-base-content/30 hover:text-warning"}`}
                        title={
                          isPinned ? "Unpin conversation" : "Pin conversation"
                        }
                      >
                        {isPinned ? (
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

                {activeConvo.type === ChatType.GROUP &&
                activeConvo.members?.length ? (
                  <GroupAvatar
                    users={activeConvo.members.map((m) => ({
                      id: m.id,
                      name: m.name,
                      image: m.image ?? undefined,
                    }))}
                  />
                ) : (
                  <UserAvatar
                    user={
                      primaryUserByConvo[activeConvo.id] ?? {
                        id: String(activeConvo.id),
                        name: activeConvo.name,
                        image: activeConvo.src,
                      }
                    }
                    size="md"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-base-content truncate">
                    {activeConvo.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    {activeConvo.type === ChatType.GROUP ? (
                      <span className="text-xs text-base-content/50 flex items-center gap-1">
                        <FiUsers className="w-3 h-3" />
                        {activeConvo.members?.length ?? 0} members
                      </span>
                    ) : (
                      <>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${getRoleBadge().cls}`}
                        >
                          {getRoleBadge().label}
                        </span>
                        {false ? (
                          <span className="text-xs text-success font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                            Active now
                          </span>
                        ) : false ? (
                          <span className="text-xs text-primary font-medium">
                            Typing...
                          </span>
                        ) : (
                          <span className="text-xs text-base-content/40">
                            {formatLastSeen(undefined)}
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
                const pinned = activeMessages.filter(
                  (m) =>
                    isMessagePinned(activeConvo.id, m.id) &&
                    !isMessageUnsent(activeConvo.id, m.id),
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
                        {pinned[pinned.length - 1].content || "Message"}
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
                              const pinnedText = isAttachmentPlaceholderText(
                                msg.content,
                                Boolean(msg.fileId),
                              )
                                ? "Attachment"
                                : msg.content;
                              const sender =
                                msg.userId === viewerId
                                  ? "You"
                                  : activeConvo.type === ChatType.GROUP
                                    ? (activeConvo.members
                                        ?.find((u) => u.id === msg.userId)
                                        ?.name.split(" ")[0] ??
                                      activeConvo.name.split(" ")[0])
                                    : activeConvo.name.split(" ")[0];
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
                                        {formatFullTime(
                                          msg.createdAt.toString(),
                                        )}
                                      </span>
                                    </div>
                                    <p className="text-xs text-base-content/70 truncate">
                                      {pinnedText}
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
                        const fileAccess = fileAccessByMessageId[msg.id];
                        const isVideo = Boolean(
                          fileAccess?.mimeType?.startsWith("video/"),
                        );
                        const isAudio = Boolean(
                          fileAccess?.mimeType?.startsWith("audio/"),
                        );
                        const canInlineAutoplay = autoplayMediaMessageIds.has(
                          msg.id,
                        );
                        const isOwn = msg.userId === viewerId;
                        const isDeleted = isMessageUnsent(
                          activeConvo.id,
                          msg.id,
                        );
                        const isPinned = isMessagePinned(
                          activeConvo.id,
                          msg.id,
                        );
                        const isImageMessage =
                          Boolean(msg.fileId) &&
                          Boolean(fileAccess?.isImage) &&
                          !isDeleted;
                        const previousMsg = group.messages[i - 1];
                        const previousAccess = previousMsg
                          ? fileAccessByMessageId[previousMsg.id]
                          : undefined;
                        const previousDeleted = previousMsg
                          ? isMessageUnsent(activeConvo.id, previousMsg.id)
                          : false;
                        const isContinuationImage =
                          isImageMessage &&
                          Boolean(previousMsg) &&
                          !previousDeleted &&
                          previousMsg?.userId === msg.userId &&
                          Boolean(previousMsg?.fileId) &&
                          Boolean(previousAccess?.isImage);
                        if (isContinuationImage) {
                          return null;
                        }

                        const imageCluster = isImageMessage
                          ? group.messages.slice(i).filter((candidate, idx) => {
                              if (idx === 0) return true;
                              const prevCandidate = group.messages[i + idx - 1];
                              const candidateAccess =
                                fileAccessByMessageId[candidate.id];
                              const candidateDeleted = isMessageUnsent(
                                activeConvo.id,
                                candidate.id,
                              );
                              const prevCandidateAccess =
                                fileAccessByMessageId[prevCandidate.id];
                              const prevCandidateDeleted = isMessageUnsent(
                                activeConvo.id,
                                prevCandidate.id,
                              );
                              if (candidateDeleted || prevCandidateDeleted)
                                return false;
                              return (
                                candidate.userId === msg.userId &&
                                Boolean(candidate.fileId) &&
                                Boolean(candidateAccess?.isImage) &&
                                Boolean(prevCandidate.fileId) &&
                                Boolean(prevCandidateAccess?.isImage)
                              );
                            })
                          : [];
                        const imageClusterUrls = imageCluster
                          .map(
                            (imageMsg) =>
                              fileAccessByMessageId[imageMsg.id]?.url,
                          )
                          .filter((url): url is string => Boolean(url));
                        const imageClusterCount = imageClusterUrls.length;

                        const showAvatar =
                          !isOwn &&
                          (i === 0 ||
                            group.messages[i - 1].userId !== msg.userId);
                        const isLast =
                          i === group.messages.length - 1 ||
                          group.messages[i + 1]?.userId !== msg.userId;

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
                                    user={
                                      primaryUserByConvo[activeConvo.id] ?? {
                                        id: String(activeConvo.id),
                                        name: activeConvo.name,
                                        image: activeConvo.src,
                                      }
                                    }
                                    size="sm"
                                    showStatus={false}
                                  />
                                )}
                              </div>
                            )}

                            {/* Hover actions (own messages: left side) */}
                            {isOwn && hoveredMsg === msg.id && !isDeleted && (
                              <div className="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity pb-1">
                                <button
                                  onClick={() => togglePinMessage(msg.id)}
                                  className={`btn btn-ghost btn-xs btn-square rounded-md ${isPinned ? "text-warning" : "text-base-content/30 hover:text-warning"}`}
                                  title={isPinned ? "Unpin" : "Pin"}
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
                                isDeleted
                                  ? "px-4 py-2.5 italic opacity-50 bg-base-200 text-base-content/50 rounded-2xl border border-dashed border-base-300"
                                  : [
                                      "px-4 py-2.5",
                                      isOwn
                                        ? "bg-primary text-primary-content rounded-2xl rounded-br-md shadow-sm"
                                        : "bg-base-100 text-base-content border border-base-200 rounded-2xl rounded-bl-md shadow-xs",
                                    ].join(" "),
                                isPinned && !isDeleted
                                  ? "ring-1 ring-warning/40"
                                  : "",
                              ].join(" ")}
                            >
                              {/* Pinned indicator */}
                              {isPinned && !isDeleted && (
                                <div className="absolute -top-2 -right-2">
                                  <BsPinFill className="w-3 h-3 text-warning" />
                                </div>
                              )}

                              {/* Deleted message */}
                              {isDeleted ? (
                                <p className="flex items-center gap-1.5">
                                  <FiTrash2 className="w-3 h-3" />
                                  You unsent a message
                                </p>
                              ) : msg.fileId && fileAccess?.isImage ? (
                                <div>
                                  <button
                                    type="button"
                                    className="relative w-64 h-48 rounded-xl overflow-hidden bg-base-200"
                                    onClick={() =>
                                      setLightboxGallery({
                                        images: imageClusterUrls,
                                        index: 0,
                                      })
                                    }
                                  >
                                    <Image
                                      src={fileAccess.url}
                                      alt={fileAccess.fileName || "Image"}
                                      fill
                                      className="object-cover"
                                      unoptimized
                                    />
                                    {imageClusterCount > 1 && (
                                      <span className="absolute left-2 top-2 rounded-md bg-black/65 px-2 py-1 text-[10px] font-semibold text-white">
                                        {imageClusterCount} images
                                      </span>
                                    )}
                                  </button>
                                  <div
                                    className={`text-[10px] mt-1.5 ${
                                      isOwn
                                        ? "text-primary-content/60"
                                        : "text-base-content/35"
                                    }`}
                                  >
                                    {formatFullTime(msg.createdAt.toString())}
                                  </div>
                                </div>
                              ) : msg.fileId && isVideo ? (
                                <div className="w-72">
                                  <div className="mb-2 inline-flex items-center gap-1 rounded-md bg-base-200 px-2 py-0.5 text-[10px] font-semibold text-base-content/70">
                                    <FiVideo className="w-3 h-3" />
                                    Video
                                  </div>
                                  <video
                                    src={fileAccess?.url}
                                    controls
                                    preload="metadata"
                                    autoPlay={canInlineAutoplay}
                                    muted={canInlineAutoplay}
                                    playsInline
                                    className="w-full rounded-xl bg-black"
                                  />
                                  <div
                                    className={`text-[10px] mt-1.5 ${
                                      isOwn
                                        ? "text-primary-content/60"
                                        : "text-base-content/35"
                                    }`}
                                  >
                                    {formatFullTime(msg.createdAt.toString())}
                                  </div>
                                </div>
                              ) : msg.fileId && isAudio ? (
                                <div className="w-72">
                                  <div className="mb-2 inline-flex items-center gap-1 rounded-md bg-base-200 px-2 py-0.5 text-[10px] font-semibold text-base-content/70">
                                    <FiMusic className="w-3 h-3" />
                                    Audio
                                  </div>
                                  <audio
                                    src={fileAccess?.url}
                                    controls
                                    preload="metadata"
                                    autoPlay={canInlineAutoplay}
                                    className="w-full"
                                  />
                                  <div
                                    className={`text-[10px] mt-1.5 ${
                                      isOwn
                                        ? "text-primary-content/60"
                                        : "text-base-content/35"
                                    }`}
                                  >
                                    {formatFullTime(msg.createdAt.toString())}
                                  </div>
                                </div>
                              ) : msg.fileId ? (
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
                                      {fileAccess?.fileName ?? "Attachment"}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end gap-0.5">
                                    <button
                                      type="button"
                                      className={`text-[10px] font-semibold ${
                                        isOwn
                                          ? "text-primary-content"
                                          : "text-primary"
                                      }`}
                                      onClick={async () => {
                                        const result = await getFileUrl(
                                          msg.id,
                                          true,
                                        );
                                        if (!result.success) {
                                          statusPopup.showError(
                                            result.error ||
                                              "Failed to download file.",
                                          );
                                          return;
                                        }
                                        window.open(
                                          result.result.url,
                                          "_blank",
                                          "noopener,noreferrer",
                                        );
                                      }}
                                    >
                                      <span className="inline-flex items-center gap-1">
                                        <FiDownload className="w-3 h-3" />
                                        Download
                                      </span>
                                    </button>
                                    <span
                                      className={`text-[10px] tabular-nums ${
                                        isOwn
                                          ? "text-primary-content/60"
                                          : "text-base-content/35"
                                      }`}
                                    >
                                      {formatFullTime(msg.createdAt.toString())}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                /* Text message */
                                <>
                                  {!isAttachmentPlaceholderText(
                                    msg.content,
                                    Boolean(msg.fileId),
                                  ) && <p>{msg.content}</p>}
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
                                      {formatFullTime(msg.createdAt.toString())}
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Hover actions (other's messages: right side) */}
                            {!isOwn && hoveredMsg === msg.id && !isDeleted && (
                              <div className="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity pb-1">
                                <button
                                  onClick={() => togglePinMessage(msg.id)}
                                  className={`btn btn-ghost btn-xs btn-square rounded-md ${isPinned ? "text-warning" : "text-base-content/30 hover:text-warning"}`}
                                  title={isPinned ? "Unpin" : "Pin"}
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

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handlePickedFiles(e.target.files, "file");
                    e.currentTarget.value = "";
                  }}
                />
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handlePickedFiles(e.target.files, "image");
                    e.currentTarget.value = "";
                  }}
                />

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
                    <button
                      onClick={
                        isRecordingAudio
                          ? stopAudioRecording
                          : startAudioRecording
                      }
                      className={`btn btn-ghost btn-xs btn-square rounded-lg ${isRecordingAudio ? "text-error" : "text-base-content/40 hover:text-primary"}`}
                      title={
                        isRecordingAudio ? "Stop recording" : "Record audio"
                      }
                    >
                      {isRecordingAudio ? (
                        <FiSquare className="w-4 h-4" />
                      ) : (
                        <FiMic className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Input */}
                  <div className="flex-1 relative">
                    {isRecordingAudio && (
                      <span className="absolute -top-5 left-2 text-[10px] font-semibold text-error">
                        Recording {formatRecordingTime(recordingSeconds)}
                      </span>
                    )}
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
              onClick={(e: React.MouseEvent<HTMLDivElement>) =>
                e.stopPropagation()
              }
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
        {lightboxGallery && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={() => setLightboxGallery(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e: React.MouseEvent<HTMLDivElement>) =>
                e.stopPropagation()
              }
              className="relative max-w-3xl max-h-[80vh] w-full"
            >
              <button
                onClick={() => setLightboxGallery(null)}
                className="absolute -top-10 right-0 btn btn-ghost btn-sm btn-circle text-white/70 hover:text-white hover:bg-white/10"
              >
                <FiX className="w-5 h-5" />
              </button>
              {lightboxGallery.images.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setLightboxGallery((prev) =>
                        prev
                          ? {
                              ...prev,
                              index:
                                (prev.index - 1 + prev.images.length) %
                                prev.images.length,
                            }
                          : prev,
                      )
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-sm btn-circle text-white/70 hover:text-white hover:bg-white/10 z-10"
                  >
                    <FiChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() =>
                      setLightboxGallery((prev) =>
                        prev
                          ? {
                              ...prev,
                              index: (prev.index + 1) % prev.images.length,
                            }
                          : prev,
                      )
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-sm btn-circle text-white/70 hover:text-white hover:bg-white/10 z-10"
                  >
                    <FiChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
              <div className="relative w-full h-[70vh] rounded-xl overflow-hidden bg-base-200/10">
                <Image
                  src={lightboxGallery.images[lightboxGallery.index] ?? ""}
                  alt="Image preview"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
              {lightboxGallery.images.length > 1 && (
                <p className="mt-2 text-center text-xs text-white/75">
                  {lightboxGallery.index + 1} / {lightboxGallery.images.length}
                </p>
              )}
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
              onClick={(e: React.MouseEvent<HTMLDivElement>) =>
                e.stopPropagation()
              }
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

