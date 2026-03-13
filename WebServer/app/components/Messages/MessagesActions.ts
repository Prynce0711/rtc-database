"use server";

import { ChatData, Message } from "@/@types/network";
import ActionResult from "@/app/components/ActionResult";
import { ChatType } from "@/app/generated/prisma/browser";
import { Recipient } from "@/app/lib/socket/SocketEvents";

import { validateSession } from "@/app/lib/authActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";

// TODO: Make it so chat name is dependent on the other user's name if it is direct

// only returns latest message for each chat
// useMessaging will fetch all messages for the selected chat
export async function getChats(): Promise<ActionResult<ChatData[]>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const chats = await prisma.chat.findMany({
      where: {
        members: {
          some: {
            userId: sessionResult.result.id,
          },
        },
      },

      select: {
        id: true,
        name: true,
        createdAt: true,
        type: true,
        members: {
          select: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                email: true,
              },
            },
          },
        },
        messages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            fileId: true,
            userId: true,
            content: true,
            createdAt: true,
          },
        },
        lastMessageAt: true,
      },

      orderBy: {
        lastMessageAt: "desc",
      },
    });

    if (!chats || chats.length === 0) {
      return {
        success: true,
        result: [],
      };
    }

    const parsedChats = await Promise.all(
      chats.map(async (chat) => {
        const member = chat.members.find(
          (member) => member.user.id !== sessionResult.result.id,
        )?.user;

        const members: Recipient[] = chat.members.map((chatMember) => ({
          id: chatMember.user.id,
          name: chatMember.user.name,
          image: chatMember.user.image,
        }));

        return {
          id: chat.id,
          name:
            chat.type === ChatType.GROUP
              ? chat.name || "Group chat"
              : member?.name || member?.email || "Unknown",
          email: member?.email || "",
          type: chat.type,
          src: member?.image,
          latestMessage: chat.messages[0]
            ? ({
                ...chat.messages[0],
                fileId: chat.messages[0].fileId ?? null,
                name: member?.name || member?.email || "Unknown",
                src: member?.image || undefined,
              } as Message)
            : undefined,
          members,
        } as ChatData;
      }),
    );

    console.log("Fetched chats:", parsedChats);

    return { success: true, result: parsedChats };
  } catch (err) {
    console.error("Error in getChats:", err);
    return { success: false, error: (err as Error).message };
  }
}

export async function getDirectChatId(
  userId: string,
): Promise<ActionResult<number>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    if (!userId || typeof userId !== "string") {
      throw new Error("Invalid user ID");
    }

    const existingChat = await prisma.chat.findFirst({
      where: {
        type: ChatType.DIRECT,
        members: {
          every: {
            userId: { in: [sessionResult.result.id, userId] },
          },
        },
      },
    });

    if (!existingChat) {
      return { success: false, error: "Direct chat not found" };
    }

    return { success: true, result: existingChat.id };
  } catch (err) {
    console.error("Error in getDirectChatId:", err);
    return { success: false, error: (err as Error).message };
  }
}

export type ChatInfo = {
  chatId: number;
  chatName?: string;
  recipients: Recipient[];
};

export async function getChatInfo(
  id: number,
): Promise<ActionResult<ChatInfo | null>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    if (!id || typeof id !== "number") {
      return { success: false, error: "Invalid chat ID" };
    }

    const chat = await prisma.chat.findUnique({
      where: { id },
      select: {
        members: {
          select: { user: { select: { id: true, image: true, name: true } } },
        },
        name: true,
        id: true,
      },
    });

    if (!chat) {
      return { success: false, error: "Chat not found" };
    }

    if (
      !chat.members.some((member) => member.user.id === sessionResult.result.id)
    ) {
      return { success: false, error: "You are not a member of this chat" };
    }

    return {
      success: true,
      result: {
        chatId: chat.id,
        chatName: chat.name,
        recipients: chat.members.map((member) => ({
          id: member.user.id,
          name: member.user.name,
          image: member.user.image,
        })),
      } as ChatInfo,
    };
  } catch (err) {
    console.error("Error in getChatInfo:", err);
    return { success: false, error: "Error fetching chat info" };
  }
}

export async function getChatById(
  id: number,
): Promise<ActionResult<Message[]>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    if (!id || typeof id !== "number") {
      return { success: false, error: "Invalid chat ID" };
    }

    const chat = await prisma.chat.findUnique({
      where: { id },
      include: {
        members: {
          where: { userId: sessionResult.result.id },
          select: { userId: true },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: { name: true, image: true },
            },
          },
        },
      },
    });

    if (!chat) {
      throw new Error("Chat not found");
    }

    if (
      !chat.members.some((member) => member.userId === sessionResult.result.id)
    ) {
      return { success: false, error: "You are not a member of this chat" };
    }

    const messages: Message[] = chat.messages.map((msg) => ({
      id: msg.id,
      chatId: msg.chatId,
      userId: msg.userId,
      fileId: msg.fileId ?? null,
      content: msg.content,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
      name: msg.user?.name || "Unknown",
      src: msg.user?.image || undefined,
    }));

    return { success: true, result: messages };
  } catch (err) {
    console.error("Error in getChatById:", err);
    return { success: false, error: "Error fetching chat messages" };
  }
}

export async function createGroupChat(
  name: string,
  memberIds: string[],
): Promise<ActionResult<number>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }
    if (!name || typeof name !== "string") {
      return { success: false, error: "Invalid chat name" };
    }

    const chat = await prisma.chat.create({
      data: {
        name,
        type: ChatType.GROUP,
        members: {
          create: [
            { userId: sessionResult.result.id },
            ...memberIds.map((id) => ({ userId: id })),
          ],
        },
      },
    });

    return { success: true, result: chat.id };
  } catch (err) {
    console.error("Error in createGroupChat:", err);
    return { success: false, error: "Error creating group chat" };
  }
}

export async function leaveChat(
  chatId: number,
): Promise<ActionResult<undefined>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
          where: { userId: sessionResult.result.id },
        },
      },
    });

    if (!chat) {
      return { success: false, error: "Chat not found" };
    }

    if (chat.type !== ChatType.GROUP) {
      return { success: false, error: "Cannot leave a direct chat" };
    }

    await prisma.chatMember.deleteMany({
      where: {
        chatId,
        userId: sessionResult.result.id,
      },
    });

    return { success: true, result: undefined };
  } catch (err) {
    console.error("Error in leaveChat:", err);
    return { success: false, error: "Error leaving chat" };
  }
}

export async function deleteChat(
  chatId: number,
): Promise<ActionResult<undefined>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
          where: { userId: sessionResult.result.id },
        },
      },
    });

    if (!chat) {
      return { success: false, error: "Chat not found" };
    }

    if (chat.type !== ChatType.GROUP) {
      return { success: false, error: "Cannot delete a direct chat" };
    }

    await prisma.chat.deleteMany({
      where: {
        id: chatId,
        members: {
          some: {
            userId: sessionResult.result.id,
          },
        },
      },
    });

    return { success: true, result: undefined };
  } catch (err) {
    console.error("Error in deleteChat:", err);
    return { success: false, error: "Error deleting chat" };
  }
}

export const createManyChatsWithOthers = async (
  role: Roles,
  userId: string,
) => {
  const users = await prisma.user.findMany({
    where: {
      role: role,
      AND: [
        { id: { not: userId } }, // Exclude the current user
      ],
    },
    select: { id: true },
  });

  console.log("Users found for role", role, ":", users);

  const userIds = users.map((user) => user.id);
  if (userIds.length === 0) return;

  const existingChats = await prisma.chat.findMany({
    where: {
      type: ChatType.DIRECT,
      AND: [
        { members: { some: { userId } } },
        { members: { some: { userId: { in: userIds } } } },
      ],
    },
    select: {
      members: {
        select: { userId: true },
      },
    },
  });

  const existingUserIds = new Set<string>();
  for (const chat of existingChats) {
    for (const member of chat.members) {
      if (member.userId !== userId) {
        existingUserIds.add(member.userId);
      }
    }
  }

  for (const user of users) {
    if (existingUserIds.has(user.id)) continue;

    await prisma.chat.create({
      data: {
        type: ChatType.DIRECT,
        members: {
          create: [{ userId }, { userId: user.id }],
        },
      },
    });
  }
};

export const removeManyChatsWithOthers = async (
  role: Roles,
  userId: string,
) => {
  const users = await prisma.user.findMany({
    where: {
      role,
      AND: [
        { id: { not: userId } }, // Exclude the current user
      ],
    },
    select: { id: true },
  });

  users.forEach(async (user) => {
    await prisma.chat.deleteMany({
      where: {
        members: {
          every: {
            userId: {
              in: [userId, user.id],
            },
          },
        },
      },
    });
  });
};
