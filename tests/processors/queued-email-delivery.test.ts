import { beforeEach, describe, expect, it, vi } from "vitest";
import { deliverQueuedEmails } from "@/lib/notifications/queued-email-delivery";
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), update: vi.fn(), intent: vi.fn(), user: vi.fn(), message: vi.fn(), category: vi.fn(), route: vi.fn(), suppressed: vi.fn(), evaluate: vi.fn(), security: vi.fn(), deliver: vi.fn(), ready: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { notificationDelivery: { findMany: mocks.findMany, updateMany: mocks.update }, notificationEventIntent: { findUnique: mocks.intent }, user: { findUnique: mocks.user }, notificationMessage: { findUnique: mocks.message }, notificationCategory: { findUnique: mocks.category }, notificationEventRouteVersion: { findUnique: mocks.route } } }));
vi.mock("@/lib/notifications/production-readiness", () => ({ assertNotificationProductionReady: mocks.ready }));
vi.mock("@/lib/notifications/security-email-delivery", () => ({ deliverSecurityEmail: mocks.security }));
vi.mock("@/lib/notifications/composition-root", () => ({ resolveNotificationProductionComposition: () => ({ services: { delivery: { deliver: mocks.deliver }, suppressions: { isSuppressed: mocks.suppressed }, preferences: { evaluate: mocks.evaluate } } }) }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.findMany.mockResolvedValue([{ id: "email", messageId: "message", recipientUserId: "user", publicReference: "public-email" }]);
  mocks.message.mockResolvedValue({ recipientUserId: "user", categoryKey: "orders", purpose: "TRANSACTIONAL" });
  mocks.category.mockResolvedValue({ key: "orders", status: "ACTIVE", purpose: "TRANSACTIONAL" });
  mocks.suppressed.mockResolvedValue(false); mocks.evaluate.mockResolvedValue({ state: "IMMEDIATE" });
});
describe("real queued email processor adapter", () => {
  it("honours current suppression and preference decisions before sending a previously queued message", async () => {
    mocks.intent.mockResolvedValue(null); mocks.user.mockResolvedValue({ email: "verified@example.test", emailVerifiedAt: new Date(), status: "ACTIVE" });
    mocks.suppressed.mockResolvedValue(true); mocks.evaluate.mockResolvedValue({ state: "BLOCKED", reason: "SUPPRESSED_DESTINATION" });
    expect((await deliverQueuedEmails(50)).itemsSkipped).toBe(1);
    expect(mocks.evaluate).toHaveBeenCalledWith(expect.objectContaining({ suppressed: true, verifiedDestination: true }));
    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "ELIGIBILITY_BLOCKED", eligibilityReason: "SUPPRESSED_DESTINATION", nextAttemptAt: null } }));
  });
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
  it("defers quiet-hours email so later eligible messages are not starved", async () => {
    mocks.intent.mockResolvedValue(null); mocks.user.mockResolvedValue({ email: "verified@example.test", emailVerifiedAt: new Date(), status: "ACTIVE" });
    mocks.evaluate.mockResolvedValue({ state: "QUEUED", reason: "QUIET_HOURS" });
    await deliverQueuedEmails(50);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: { nextAttemptAt: expect.any(Date) } }));
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
  it("blocks a retired route and expires old deliveries before a provider call", async () => {
    mocks.intent.mockResolvedValue(null); mocks.user.mockResolvedValue({ email: "verified@example.test", emailVerifiedAt: new Date(), status: "ACTIVE" });
    mocks.message.mockResolvedValue({ recipientUserId: "user", categoryKey: "orders", purpose: "TRANSACTIONAL", routeVersionId: "retired" });
    mocks.route.mockResolvedValue({ status: "RETIRED" });
    await deliverQueuedEmails(50);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "ELIGIBILITY_BLOCKED", eligibilityReason: "ROUTE_NOT_ACTIVE" }) }));
    mocks.findMany.mockResolvedValue([{ id: "expired", expiresAt: new Date(0) }]);
    await deliverQueuedEmails(50);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "EXPIRED", nextAttemptAt: null } }));
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
});
