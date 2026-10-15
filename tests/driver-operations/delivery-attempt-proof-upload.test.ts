import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authority: vi.fn(), upload: vi.fn(), current: vi.fn(), stored: vi.fn(), register: vi.fn() }));
vi.mock("@/lib/driver-operations/authority", () => ({ assertAcceptedCurrentDriver: mocks.authority }));
vi.mock("@/lib/private-media/private-media.service", () => ({ PrivateMediaService: class { upload = mocks.upload; } }));
vi.mock("@/lib/driver-operations/proof-evidence-authority", () => ({ registerValidatedProofUploadInTx: mocks.register }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: async (work: (tx: unknown) => unknown) => work({ orderAssignment: { findFirst: mocks.current }, privateMediaObject: { findFirst: mocks.stored } }) } }));
import { uploadDeliveryProof } from "@/lib/services/delivery-proof-upload.service";

describe("private delivery-attempt evidence upload", () => {
  const input = { assignmentId: "assignment", assignmentVersion: 3, driverProfileId: "driver", actor: { userId: "driver-user", role: "DRIVER" as const }, fileName: "damage.png", mimeType: "image/png", bytes: new Uint8Array([1]) };
  beforeEach(() => {
    mocks.authority.mockResolvedValue({ orderId: "order", orderStatus: "PICKED_UP", driverUserId: "driver-user" });
    mocks.upload.mockResolvedValue({ publicReference: "PMO-proof", mimeType: "image/png", byteSize: 1 });
    mocks.current.mockResolvedValue({ id: "assignment" }); mocks.stored.mockResolvedValue({ publicReference: "PMO-proof", storageProvider: "PRIVATE", detectedMimeType: "image/png", byteSize: 1 });
    mocks.register.mockResolvedValue({ evidenceReference: "dpod_proof" });
  });
  it("allows evidence for a damaged or unsafe parcel immediately after verified pickup custody", async () => {
    await expect(uploadDeliveryProof(input)).resolves.toMatchObject({ evidenceReference: "dpod_proof" });
    expect(mocks.register).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ orderId: "order", assignmentId: "assignment", driverProfileId: "driver", driverUserId: "driver-user" }));
  });
  it("rejects evidence before parcel custody", async () => {
    mocks.authority.mockResolvedValue({ orderId: "order", orderStatus: "PICKUP_SCHEDULED", driverUserId: "driver-user" });
    await expect(uploadDeliveryProof(input)).rejects.toMatchObject({ code: "DRIVER_OPERATION_FORBIDDEN" });
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("rejects an assignment revoked while the private upload was in progress", async () => {
    mocks.current.mockResolvedValue(null);
    await expect(uploadDeliveryProof(input)).rejects.toMatchObject({ code: "DRIVER_OPERATION_STALE" });
    expect(mocks.register).not.toHaveBeenCalled();
  });
});
