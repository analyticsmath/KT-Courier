import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import type { AuthenticatedUser } from "@/types/domain";
import { hasPermission } from "@/lib/auth/permissions";
import { storeAccess } from "./store-access";
import { PlatformError } from "./contracts";
import type { Prisma } from "@prisma/client";
export const ConversationSchema = z
  .object({
    kind: z.enum(["DELIVERY", "SUPPORT"]),
    subject: z.string().trim().min(3).max(150),
    orderId: z.string().cuid().optional(),
    business: z.boolean().default(false),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.kind === "DELIVERY" && !v.orderId)
      c.addIssue({
        code: "custom",
        path: ["orderId"],
        message: "Select a delivery.",
      });
    if (v.kind === "SUPPORT" && v.orderId)
      c.addIssue({
        code: "custom",
        path: ["orderId"],
        message: "Use delivery chat for a delivery conversation.",
      });
  });
export const MessageSchema = z
  .object({
    body: z.string().trim().min(1).max(4000),
    operationId: z.string().regex(/^[A-Za-z0-9_-]{12,100}$/),
  })
  .strict();
export type ConversationScope = "personal" | "STORE" | "admin";
async function supportAdmin(user: AuthenticatedUser) {
  return (
    ["ADMIN", "SUPER_ADMIN"].includes(user.role) &&
    (await hasPermission({
      userId: user.id,
      role: user.role,
      permissionKey: "claims.investigate",
    }))
  );
}
async function scopeWhere(
  user: AuthenticatedUser,
  scope: ConversationScope,
): Promise<Prisma.PlatformConversationWhereInput> {
  if (scope === "admin") {
    if (!(await supportAdmin(user)))
      throw new PlatformError(
        "CHAT_FORBIDDEN",
        "Support access is required.",
        403,
      );
    return { kind: "SUPPORT" };
  }
  if (scope === "STORE") {
    const a = await storeAccess(user.id, "chat");
    return {
      OR: [
        { kind: "SUPPORT", storeId: a.store.id },
        { kind: "DELIVERY", order: { storeId: a.store.id } },
      ],
    };
  }
  return {
    OR: [
      { kind: "SUPPORT", createdByUserId: user.id, storeId: null },
      {
        kind: "DELIVERY",
        order: {
          OR: [
            { customerId: user.id },
            { currentDriverProfile: { userId: user.id, status: "ACTIVE" } },
          ],
        },
      },
    ],
  };
}
const projection = {
  id: true,
  kind: true,
  subject: true,
  orderId: true,
  storeId: true,
  closedAt: true,
  updatedAt: true,
} as const;
export async function listConversations(
  user: AuthenticatedUser,
  scope: ConversationScope,
) {
  return prisma.platformConversation.findMany({
    where: await scopeWhere(user, scope),
    select: projection,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 100,
  });
}
async function allowedConversation(
  user: AuthenticatedUser,
  id: string,
  scope: ConversationScope,
  tx: Prisma.TransactionClient = prisma,
) {
  const row = await tx.platformConversation.findFirst({
    where: { AND: [{ id }, await scopeWhere(user, scope)] },
    select: projection,
  });
  if (!row)
    throw new PlatformError(
      "CONVERSATION_NOT_FOUND",
      "Conversation not found.",
      404,
    );
  return row;
}
export async function openConversation(
  user: AuthenticatedUser,
  input: z.infer<typeof ConversationSchema>,
) {
  input = ConversationSchema.parse(input);
  if (!["CUSTOMER", "STORE", "DRIVER"].includes(user.role))
    throw new PlatformError(
      "CHAT_FORBIDDEN",
      "Use the support inbox to reply to a conversation.",
      403,
    );
  const scope: ConversationScope = input.business ? "STORE" : "personal";
  const a = input.business ? await storeAccess(user.id, "chat") : null;
  if (input.kind === "SUPPORT")
    return prisma.platformConversation.create({
      data: {
        kind: "SUPPORT",
        subject: input.subject,
        storeId: a?.store.id ?? null,
        createdByUserId: user.id,
        members: { create: { userId: user.id } },
      },
      select: projection,
    });
  const order = await prisma.order.findFirst({
    where: {
      id: input.orderId,
      ...(a
        ? { storeId: a.store.id }
        : {
            OR: [
              { customerId: user.id },
              { currentDriverProfile: { userId: user.id, status: "ACTIVE" } },
            ],
          }),
    },
    select: {
      id: true,
      storeId: true,
      currentDriverProfile: { select: { userId: true, status: true } },
    },
  });
  if (!order)
    throw new PlatformError("ORDER_NOT_FOUND", "Delivery not found.", 404);
  if (
    !order.currentDriverProfile ||
    order.currentDriverProfile.status !== "ACTIVE"
  )
    throw new PlatformError(
      "DRIVER_NOT_ASSIGNED",
      "Delivery chat becomes available when an active driver is assigned.",
      409,
    );
  const row = await prisma.platformConversation.upsert({
    where: { orderId_kind: { orderId: order.id, kind: "DELIVERY" } },
    create: {
      kind: "DELIVERY",
      subject: input.subject,
      orderId: order.id,
      storeId: order.storeId,
      createdByUserId: user.id,
      members: { create: { userId: user.id } },
    },
    update: {},
    select: projection,
  });
  return allowedConversation(user, row.id, scope);
}
export async function conversationMessages(
  user: AuthenticatedUser,
  id: string,
  scope: ConversationScope,
  before?: string,
  after?: string,
) {
  if (before && after)
    throw new PlatformError(
      "CHAT_CURSOR_INVALID",
      "Choose one message cursor.",
    );
  await allowedConversation(user, id, scope);
  const cursorId = before ?? after;
  const cursor = cursorId
    ? await prisma.platformConversationMessage.findFirst({
        where: { id: cursorId, conversationId: id },
        select: { id: true, createdAt: true },
      })
    : null;
  if (cursorId && !cursor)
    throw new PlatformError(
      "CHAT_CURSOR_INVALID",
      "Message cursor not found.",
      404,
    );
  const direction = before ? "lt" : "gt";
  const rows = await prisma.platformConversationMessage.findMany({
    where: {
      conversationId: id,
      ...(cursor
        ? {
            OR: [
              { createdAt: { [direction]: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { [direction]: cursor.id } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      body: true,
      createdAt: true,
      senderUserId: true,
      sender: { select: { name: true, role: true } },
    },
    orderBy: [
      { createdAt: after ? "asc" : "desc" },
      { id: after ? "asc" : "desc" },
    ],
    take: 51,
  });
  const hasMore = rows.length > 50;
  const page = rows.slice(0, 50);
  if (!after) page.reverse();
  await prisma.platformConversationMember.upsert({
    where: { conversationId_userId: { conversationId: id, userId: user.id } },
    create: { conversationId: id, userId: user.id, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });
  return {
    messages: page.map((r) => ({
      id: r.id,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
      mine: r.senderUserId === user.id,
      senderName:
        r.sender.name ??
        (r.sender.role === "DRIVER"
          ? "Delivery driver"
          : ["ADMIN", "SUPER_ADMIN"].includes(r.sender.role)
            ? "KT support"
            : "Customer"),
    })),
    hasMore,
  };
}
export async function sendConversationMessage(
  user: AuthenticatedUser,
  id: string,
  scope: ConversationScope,
  input: z.infer<typeof MessageSchema>,
) {
  input = MessageSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`conversation:${id}`}))`;
    const conv = await allowedConversation(user, id, scope, tx);
    if (conv.closedAt)
      throw new PlatformError(
        "CONVERSATION_CLOSED",
        "This conversation is closed.",
        409,
      );
    const previous = await tx.platformConversationMessage.findUnique({
      where: {
        conversationId_senderUserId_operationId: {
          conversationId: id,
          senderUserId: user.id,
          operationId: input.operationId,
        },
      },
    });
    if (previous) {
      if (previous.body !== input.body)
        throw new PlatformError(
          "MESSAGE_CONFLICT",
          "This operation belongs to a different message.",
          409,
        );
      return { id: previous.id, replayed: true };
    }
    const message = await tx.platformConversationMessage.create({
      data: {
        conversationId: id,
        senderUserId: user.id,
        body: input.body,
        operationId: input.operationId,
      },
      select: { id: true },
    });
    await tx.platformConversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
    await tx.platformConversationMember.upsert({
      where: { conversationId_userId: { conversationId: id, userId: user.id } },
      create: { conversationId: id, userId: user.id, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
    return { id: message.id, replayed: false };
  });
}
