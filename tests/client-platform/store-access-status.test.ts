import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  store: { findMany: vi.fn() },
  storeEmployeeMembership: { findMany: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
import { storeAccess } from "@/lib/client-platform/store-access";
beforeEach(() => {
  vi.resetAllMocks();
  db.user.findUnique.mockResolvedValue({ status: "ACTIVE", role: "STORE" });
});
describe("owned store status restrictions", () => {
  it.each(["SUSPENDED", "DISABLED"])("rejects deliveries for a %s store", async status => {
    db.store.findMany.mockResolvedValue([{ id: "store-one", status }]);
    await expect(storeAccess("owner-one", "deliveries")).rejects.toMatchObject({ code: "STORE_SUSPENDED", status: 403 });
    expect(db.storeEmployeeMembership.findMany).not.toHaveBeenCalled();
  });
  it("permits active owned stores", async () => {
    db.store.findMany.mockResolvedValue([{ id: "store-one", status: "ACTIVE" }]);
    await expect(storeAccess("owner-one", "deliveries")).resolves.toMatchObject({ store: { id: "store-one" }, owner: true });
  });
  it("retains access for pending onboarding", async () => {
    db.store.findMany.mockResolvedValue([{ id: "store-one", status: "PENDING" }]);
    await expect(storeAccess("owner-one", "profile")).resolves.toMatchObject({ store: { id: "store-one" }, owner: true });
  });
});
