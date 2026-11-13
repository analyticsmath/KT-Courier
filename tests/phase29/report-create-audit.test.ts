import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ created: false, audit: vi.fn() }));
vi.mock("@/lib/db", () => {
  const client = { $queryRaw: vi.fn(async () => []), reportJob: { findFirst: vi.fn(async () => null), create: vi.fn(async () => { state.created = true; return { publicReference: "REP-test" }; }) }, reportAuditEvent: { create: state.audit }, $transaction: async (fn: (tx: unknown) => Promise<unknown>) => { try { return await fn(client); } catch (error) { state.created = false; throw error; } } };
  return { db: client };
});
vi.mock("@/lib/reporting/authorization", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/reporting/authorization")>()), authorizeReportDefinition: vi.fn(async () => {}) }));
import { computeRequestHash, ReportJobService } from "@/lib/reporting/services";

it("does not leave a queued report if request audit fails", async () => {
  state.created = false; state.audit.mockRejectedValueOnce(new Error("audit unavailable"));
  const service = new ReportJobService({ provider: "LOCAL_SECURE" } as never);
  await expect(service.createJob({ definitionKey: "customer-courier-orders", requesterUserId: "owner", requesterRole: "CUSTOMER", ownerScope: { userId: "owner" }, permissionSnapshot: [], filters: {}, executionMode: "ASYNCHRONOUS_EXPORT", outputFormat: "JSON" })).rejects.toThrow();
  expect(state.created).toBe(false);
});

it("distinguishes owner scopes while normalizing object key order", () => {
  const hash = (scope: Record<string, unknown>) => computeRequestHash("definition", "owner", "filters", "CSV", scope);
  expect(hash({ storeId: "one", region: "south" })).toBe(hash({ region: "south", storeId: "one" }));
  expect(hash({ storeId: "one" })).not.toBe(hash({ storeId: "two" }));
});
