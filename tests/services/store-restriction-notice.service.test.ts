import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  store: { findFirst: vi.fn() },
  adminActivityLog: { findFirst: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: mock }));
import {
  getOwnedStoreRestriction,
  vendorVisibleStatusReason,
} from "@/lib/services/store-restriction-notice.service";

beforeEach(() => {
  vi.clearAllMocks();
  mock.store.findFirst.mockResolvedValue({
    id: "store-1", name: "Vendor", status: "SUSPENDED", updatedAt: new Date(),
  });
  mock.adminActivityLog.findFirst.mockResolvedValue({
    createdAt: new Date("2026-10-20T12:00:00Z"),
    metadata: { from: "ACTIVE", to: "SUSPENDED", reason: "Unpaid invoice requiring settlement." },
  });
});

describe("vendor restriction notice", () => {
  it("limits the business record to the signed-in owner and restricted status", async () => {
    const result = await getOwnedStoreRestriction("owner-1");
    expect(mock.store.findFirst).toHaveBeenCalledWith({
      where: { ownerUserId: "owner-1", status: { in: ["SUSPENDED", "DISABLED"] } },
      select: { id: true, name: true, status: true, updatedAt: true },
    });
    expect(result?.reason).toBe("Unpaid invoice requiring settlement.");
  });
  it("reveals no status or reason to users who do not own a restricted store", async () => {
    mock.store.findFirst.mockResolvedValue(null);
    expect(await getOwnedStoreRestriction("nonowner")).toBeNull();
    expect(mock.adminActivityLog.findFirst).not.toHaveBeenCalled();
  });
  it("does not show stale reasons from a different status transition", () => {
    expect(vendorVisibleStatusReason("SUSPENDED", {
      to: "DISABLED", reason: "An unrelated historical account issue.",
    })).toBeNull();
  });
  it("ignores absent or invalid reasons without fabricating a reason", () => {
    expect(vendorVisibleStatusReason("DISABLED", null)).toBeNull();
    expect(vendorVisibleStatusReason("DISABLED", { to: "DISABLED", reason: "short" })).toBeNull();
    expect(vendorVisibleStatusReason("ACTIVE", { to: "ACTIVE", reason: "A past warning with details." })).toBeNull();
  });
});
