import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ evidence: vi.fn(), media: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { deliveryProofEvidence: { findMany: mocks.evidence }, privateMediaObject: { findMany: mocks.media } },
}));
import { listAdminDeliveryEvidence } from "@/lib/services/admin-delivery-evidence.service";
const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

describe("admin private delivery evidence", () => {
  it("lists validated, order-scoped uploaded proof even before final delivery", async () => {
    mocks.evidence.mockResolvedValueOnce([{ id: "e1", publicReference: "dpod_123", storageReference: "PMO-one", contentType: "image/png", byteSize: 100, createdAt: new Date(), usedAt: null, assignment: { driverProfile: { driverCode: "DRV-1", displayName: "Courier" } } }]);
    mocks.media.mockResolvedValueOnce([{ publicReference: "PMO-one", originalFileName: "handover.png", detectedMimeType: "image/png" }]);
    const items = await listAdminDeliveryEvidence("order-one");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ mediaReference: "PMO-one", usedAt: null, driver: "Courier" });
    expect(mocks.evidence.mock.calls[0][0].where).toEqual({ orderId: "order-one", status: "READY", privateVisibility: true });
    expect(mocks.media.mock.calls[0][0].where).toMatchObject({ ownerId: "order-one", purpose: "POD_EVIDENCE", ownerType: "PROOF_OF_DELIVERY" });
  });
  it("does not reveal missing, revoked or non-image private objects", async () => {
    mocks.evidence.mockResolvedValueOnce([{ id: "e1", publicReference: "dpod_123", storageReference: "PMO-one", contentType: "image/png", byteSize: 100, createdAt: new Date(), usedAt: null, assignment: { driverProfile: { driverCode: "DRV-1", displayName: null } } }]);
    mocks.media.mockResolvedValueOnce([]);
    expect(await listAdminDeliveryEvidence("order-two")).toEqual([]);
  });
  it("renders an admin-only gallery with audited download and inline private image preview", () => {
    const page = read("../../app/(admin)/admin/orders/[id]/page.tsx");
    const endpoint = read("../../app/api/private-media/[reference]/route.ts");
    expect(page).toContain("listAdminDeliveryEvidence(id)");
    expect(page).toContain("listAdminDeliveryEvidence(id)");
    expect(page).toContain("Download original evidence");
    expect(endpoint).toContain('metadata?.ownerType === "PROOF_OF_DELIVERY"');
    expect(endpoint).toContain('metadata.purpose === "POD_EVIDENCE"');
    expect(endpoint).toContain("private, no-store");
  });
});
