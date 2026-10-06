import { beforeEach, describe, expect, it, vi } from "vitest";
import { deliverQueuedEmails } from "@/lib/notifications/queued-email-delivery";
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), intent: vi.fn(), user: vi.fn(), security: vi.fn(), deliver: vi.fn(), ready: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { notificationDelivery: { findMany: mocks.findMany }, notificationEventIntent: { findUnique: mocks.intent }, user: { findUnique: mocks.user } } }));
vi.mock("@/lib/notifications/production-readiness", () => ({ assertNotificationProductionReady: mocks.ready }));
vi.mock("@/lib/notifications/security-email-delivery", () => ({ deliverSecurityEmail: mocks.security }));
vi.mock("@/lib/notifications/composition-root", () => ({ resolveNotificationProductionComposition: () => ({ services: { delivery: { deliver: mocks.deliver } } }) }));
beforeEach(() => { vi.resetAllMocks(); mocks.findMany.mockResolvedValue([{ id: "email", messageId: "message", recipientUserId: "user", publicReference: "public-email" }]); });
describe("real queued email processor adapter", () => {
  it("uses the encrypted security path for authentication instead of rendering a generic message", async () => {
    mocks.intent.mockResolvedValue({ sourceAuthority: "AUTHENTICATION_SECURITY" });
    mocks.security.mockResolvedValue({ status: "PROVIDER_ACCEPTED" });
    expect((await deliverQueuedEmails(50)).itemsCompleted).toBe(1);
    expect(mocks.security).toHaveBeenCalledWith("email");
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
  it("requires an active verified recipient before handing ordinary email to delivery authority", async () => {
    mocks.intent.mockResolvedValue(null); mocks.user.mockResolvedValue({ email: "unverified@example.test", emailVerifiedAt: null, status: "ACTIVE" });
    expect((await deliverQueuedEmails(50)).itemsSkipped).toBe(1);
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
  it("dispatches an eligible email with a stable identity and reports retryable provider failures", async () => {
    mocks.intent.mockResolvedValue(null); mocks.user.mockResolvedValue({ email: "verified@example.test", emailVerifiedAt: new Date(), status: "ACTIVE" });
    mocks.deliver.mockResolvedValue({ status: "FAILED_RETRYABLE" });
    expect((await deliverQueuedEmails(50)).itemsRetried).toBe(1);
    expect(mocks.deliver).toHaveBeenCalledWith({ deliveryId: "email", destination: "verified@example.test", operationId: "production-email:public-email" });
  });
  it("checks the release lock before reading or sending any queued email", async () => {
    mocks.ready.mockImplementation(() => { throw new Error("locked"); });
    await expect(deliverQueuedEmails(50)).rejects.toThrow("locked");
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
