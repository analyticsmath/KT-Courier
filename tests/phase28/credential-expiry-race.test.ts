import { expect, it, vi } from "vitest";
import { DeveloperApiMaintenanceService } from "@/lib/developer-api/processor-service";

it("does not overwrite a concurrently revoked credential", async () => {
  const updateMany = vi.fn(async () => ({ count: 0 }));
  const audit = vi.fn();
  const db = { $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({ developerApiCredential: { updateMany }, developerApiAuditEvent: { create: audit } }) };
  const result = await new DeveloperApiMaintenanceService(db).expireCredential({ id: "id", publicReference: "credential" });
  expect(result).toEqual({ expired: false });
  expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: { in: ["ACTIVE", "EXPIRING"] }, expiresAt: expect.objectContaining({ lte: expect.any(Date) }) }) }));
  expect(audit).not.toHaveBeenCalled();
});

it("writes expiry audit in the same transaction as the conditional update", async () => {
  const updateMany = vi.fn(async () => ({ count: 1 }));
  const audit = vi.fn(async () => ({}));
  const db = { $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({ developerApiCredential: { updateMany }, developerApiAuditEvent: { create: audit } }) };
  const result = await new DeveloperApiMaintenanceService(db).expireCredential({ id: "id", publicReference: "credential" });
  expect(result).toEqual({ expired: true });
  expect(audit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: "DEVELOPER_CREDENTIAL_EXPIRED", entityReference: "credential" }) }));
});
