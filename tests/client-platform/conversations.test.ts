import { beforeEach, describe, it, expect, vi } from "vitest";
const db = vi.hoisted(() => ({
  platformConversation: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  platformConversationMessage: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  platformConversationMember: { upsert: vi.fn() },
  order: { findFirst: vi.fn() },
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
}));
const auth = vi.hoisted(() => ({ storeAccess: vi.fn(), permission: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/client-platform/store-access", () => ({
  storeAccess: auth.storeAccess,
}));
vi.mock("@/lib/auth/permissions", () => ({ hasPermission: auth.permission }));
import {
  listConversations,
  openConversation,
  conversationMessages,
  sendConversationMessage,
  ConversationSchema,
  MessageSchema,
} from "@/lib/client-platform/conversations.service";
const user = {
  id: "customer",
  name: "Customer",
  email: "customer@example.com",
  role: "CUSTOMER" as const,
  status: "ACTIVE" as const,
};
const orderId = "corder12345678901234567890",
  convId = "cconversation1234567890123";
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) =>
    fn(db),
  );
  db.$executeRaw.mockResolvedValue(1);
  db.platformConversation.findMany.mockResolvedValue([]);
  db.platformConversation.findFirst.mockResolvedValue({
    id: convId,
    closedAt: null,
  });
  db.platformConversationMessage.findUnique.mockResolvedValue(null);
  db.platformConversationMessage.create.mockResolvedValue({ id: "message-1" });
  db.platformConversationMember.upsert.mockResolvedValue({});
  db.platformConversation.update.mockResolvedValue({});
  auth.storeAccess.mockResolvedValue({
    store: { id: "business" },
    owner: false,
    permissions: ["chat"],
  });
});
describe("conversation authorization", () => {
  it("filters personal delivery chat by customer or current active driver", async () => {
    await listConversations(user, "personal");
    expect(
      db.platformConversation.findMany.mock.calls[0][0].where,
    ).toMatchObject({
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
    });
  });
  it("scopes business chat to the authorized business and assigned chat module", async () => {
    await listConversations(user, "STORE");
    expect(auth.storeAccess).toHaveBeenCalledWith(user.id, "chat");
    expect(
      JSON.stringify(db.platformConversation.findMany.mock.calls[0][0].where),
    ).toContain('"storeId":"business"');
  });
  it("does not let a customer browse the admin support inbox", async () => {
    await expect(listConversations(user, "admin")).rejects.toMatchObject({
      status: 403,
    });
    expect(db.platformConversation.findMany).not.toHaveBeenCalled();
  });
  it("permits authorized admin support without exposing delivery chats", async () => {
    auth.permission.mockResolvedValue(true);
    await listConversations({ ...user, role: "ADMIN" }, "admin");
    expect(db.platformConversation.findMany.mock.calls[0][0].where).toEqual({
      kind: "SUPPORT",
    });
  });
  it("rejects a foreign conversation and a replaced driver's conversation", async () => {
    db.platformConversation.findFirst.mockResolvedValue(null);
    await expect(
      conversationMessages({ ...user, role: "DRIVER" }, convId, "personal"),
    ).rejects.toMatchObject({ status: 404 });
    expect(db.platformConversationMessage.findMany).not.toHaveBeenCalled();
    expect(
      JSON.stringify(db.platformConversation.findFirst.mock.calls[0][0]),
    ).toContain(
      '"currentDriverProfile":{"userId":"customer","status":"ACTIVE"}',
    );
  });
  it("requires current assignment before creating delivery chat", async () => {
    db.order.findFirst.mockResolvedValue({
      id: orderId,
      currentDriverProfile: null,
    });
    await expect(
      openConversation(user, {
        kind: "DELIVERY",
        subject: "Delivery chat",
        orderId,
        business: false,
      }),
    ).rejects.toMatchObject({ code: "DRIVER_NOT_ASSIGNED" });
  });
  it("does not create delivery chat for another customer's order", async () => {
    db.order.findFirst.mockResolvedValue(null);
    await expect(
      openConversation(user, {
        kind: "DELIVERY",
        subject: "Delivery chat",
        orderId,
        business: false,
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(db.platformConversation.upsert).not.toHaveBeenCalled();
  });
});
describe("persistent messages", () => {
  const input = {
    body: "Please call when you arrive.",
    operationId: "message-operation-1234",
  };
  it("records the actual actor and transactionally updates the thread", async () => {
    await expect(
      sendConversationMessage(user, convId, "personal", input),
    ).resolves.toEqual({ id: "message-1", replayed: false });
    expect(
      db.platformConversationMessage.create.mock.calls[0][0].data.senderUserId,
    ).toBe(user.id);
    expect(db.$executeRaw).toHaveBeenCalled();
  });
  it("replays matching operations once", async () => {
    db.platformConversationMessage.findUnique.mockResolvedValue({
      id: "existing",
      body: input.body,
    });
    await expect(
      sendConversationMessage(user, convId, "personal", input),
    ).resolves.toEqual({ id: "existing", replayed: true });
    expect(db.platformConversationMessage.create).not.toHaveBeenCalled();
  });
  it("rejects conflicting repeated operation IDs", async () => {
    db.platformConversationMessage.findUnique.mockResolvedValue({
      id: "existing",
      body: "Different message",
    });
    await expect(
      sendConversationMessage(user, convId, "personal", input),
    ).rejects.toMatchObject({ code: "MESSAGE_CONFLICT" });
  });
  it("prevents sending to a closed conversation", async () => {
    db.platformConversation.findFirst.mockResolvedValue({
      id: convId,
      closedAt: new Date(),
    });
    await expect(
      sendConversationMessage(user, convId, "personal", input),
    ).rejects.toMatchObject({ code: "CONVERSATION_CLOSED" });
  });
  it("bounds history to 50 and rejects cursor IDs from another thread", async () => {
    db.platformConversationMessage.findFirst.mockResolvedValue(null);
    await expect(
      conversationMessages(user, convId, "personal", "foreign"),
    ).rejects.toMatchObject({ code: "CHAT_CURSOR_INVALID" });
    db.platformConversationMessage.findMany.mockResolvedValue(
      Array.from({ length: 51 }, (_, i) => ({
        id: `m${i}`,
        body: "Message",
        createdAt: new Date(),
        senderUserId: user.id,
        sender: { name: "Customer", role: "CUSTOMER" },
      })),
    );
    const result = await conversationMessages(user, convId, "personal");
    expect(result.messages).toHaveLength(50);
    expect(result.hasMore).toBe(true);
    expect(db.platformConversationMessage.findMany.mock.calls[0][0].take).toBe(
      51,
    );
  });
  it("validates text length, delivery association and request fields", () => {
    expect(
      MessageSchema.safeParse({ ...input, body: "x".repeat(4001) }).success,
    ).toBe(false);
    expect(
      ConversationSchema.safeParse({
        kind: "DELIVERY",
        subject: "Delivery chat",
      }).success,
    ).toBe(false);
    expect(
      MessageSchema.safeParse({ ...input, senderUserId: "owner" }).success,
    ).toBe(false);
  });
});
