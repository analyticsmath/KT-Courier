import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), audit: vi.fn(), ready: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findFirst: mocks.user }, notificationAuditEvent: { create: mocks.audit } } }));
vi.mock("@/lib/notifications/production-readiness", () => ({ assertNotificationProductionReady: mocks.ready }));
import { sendAdminEmailDiagnostic } from "@/lib/notifications/admin-email-diagnostic";
const provider = () => ({ name: "TEST", channel: "EMAIL" as const, send: mocks.send });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "recipient", email: "test@example.com" });
  mocks.audit.mockImplementation(async ({ data }) => ({ publicReference: data.publicReference }));
  mocks.send.mockResolvedValue({ accepted: true, providerMessageReference: "provider-id" });
});
it("audits before sending and distinguishes provider acceptance from delivery", async () => {
  const result = await sendAdminEmailDiagnostic("admin", "test@example.com", provider);
  expect(result).toMatchObject({ accepted: true, delivered: false, providerMessageId: "provider-id" });
  expect(mocks.audit.mock.invocationCallOrder[0]).toBeLessThan(mocks.send.mock.invocationCallOrder[0]);
  expect(mocks.audit).toHaveBeenCalledTimes(2);
  expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ destination: "test@example.com", subject: "KT Couriers email connection test", idempotencyKey: result.logId }));
});
it("never sends to an unverified or unknown recipient", async () => {
  mocks.user.mockResolvedValue(null);
  expect(await sendAdminEmailDiagnostic("admin", "unknown@example.com", provider)).toMatchObject({ accepted: false });
  expect(mocks.audit).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.user).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "ACTIVE", emailVerifiedAt: { not: null } }) }));
});
it("does not send when the request audit cannot be persisted", async () => {
  mocks.audit.mockRejectedValue(new Error("unavailable"));
  await expect(sendAdminEmailDiagnostic("admin", "test@example.com", provider)).rejects.toThrow();
  expect(mocks.send).not.toHaveBeenCalled();
});
it("records provider configuration failure without exposing the thrown error", async () => {
  const result = await sendAdminEmailDiagnostic("admin", "test@example.com", () => { throw new Error("secret-key"); });
  expect(result).toMatchObject({ accepted: false, delivered: false, error: "EMAIL_DIAGNOSTIC_CONFIGURATION_UNAVAILABLE" });
  expect(JSON.stringify(result)).not.toContain("secret-key");
});
it("refuses an accepted result without a provider message reference", async () => {
  mocks.send.mockResolvedValue({ accepted: true });
  expect(await sendAdminEmailDiagnostic("admin", "test@example.com", provider)).toMatchObject({ accepted: false, delivered: false });
});
