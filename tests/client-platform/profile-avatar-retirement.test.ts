import { beforeEach, describe, expect, it, vi } from "vitest";
import { replaceProfileAvatar, retireUnassociatedProfileAvatar } from "@/lib/client-platform/profile-avatar.service";
import { PrivateMediaService } from "@/lib/private-media/private-media.service";

const doubles = vi.hoisted(() => ({ userUpdate: vi.fn(), userRead: vi.fn(), mediaRead: vi.fn(), lock: vi.fn(), mediaUpdate: vi.fn(), deletion: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: doubles.transaction } }));
const actor = { userId: "owned-user", role: "CUSTOMER" as const };
const media = { requestDeletion: doubles.deletion } as unknown as PrivateMediaService;
beforeEach(() => {
  vi.resetAllMocks();
  doubles.userUpdate.mockResolvedValue({ count: 1 }); doubles.mediaUpdate.mockResolvedValue({ count: 1 }); doubles.deletion.mockResolvedValue({ status: "DELETED" });
  doubles.mediaRead.mockResolvedValue({ id: "new-media" }); doubles.lock.mockResolvedValue([{ id: actor.userId }]); doubles.userRead.mockResolvedValue({ avatarMediaReference: "winner" });
  doubles.transaction.mockImplementation(async (work: (tx: unknown) => Promise<unknown>) => work({ $queryRaw: doubles.lock, user: { updateMany: doubles.userUpdate, findUniqueOrThrow: doubles.userRead }, privateMediaObject: { updateMany: doubles.mediaUpdate, findFirst: doubles.mediaRead } }));
});
describe("profile media pointer and read revocation (mocked transaction)", () => {
  it("retires only owned prior media before attempting storage deletion", async () => {
    expect(await replaceProfileAvatar({ actor, previousReference: "old", nextReference: "new" }, media)).toEqual({ cleanupPending: false });
    expect(doubles.userUpdate).toHaveBeenCalledWith({ where: { id: actor.userId, avatarMediaReference: "old" }, data: { avatarMediaReference: "new" } });
    expect(doubles.mediaUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ publicReference: "old", ownerType: "USER", ownerId: actor.userId, purpose: "OTHER" }), data: expect.objectContaining({ status: "DELETE_REQUESTED" }) }));
    expect(doubles.deletion).toHaveBeenCalledWith({ actor, reference: "old" });
    expect(doubles.mediaUpdate.mock.invocationCallOrder[0]).toBeLessThan(doubles.deletion.mock.invocationCallOrder[0]);
  });
  it("refuses a stale pointer without touching either media object", async () => {
    doubles.userUpdate.mockResolvedValue({ count: 0 });
    await expect(replaceProfileAvatar({ actor, previousReference: "stale", nextReference: "new" }, media)).rejects.toMatchObject({ code: "PROFILE_IMAGE_CHANGED", status: 409 });
    expect(doubles.mediaUpdate).not.toHaveBeenCalled(); expect(doubles.deletion).not.toHaveBeenCalled();
  });
  it("refuses foreign previous media instead of committing a pointer-only removal", async () => {
    doubles.mediaUpdate.mockResolvedValue({ count: 0 });
    await expect(replaceProfileAvatar({ actor, previousReference: "foreign", nextReference: null }, media)).rejects.toMatchObject({ code: "PROFILE_IMAGE_AUTHORITY_INVALID" });
    expect(doubles.deletion).not.toHaveBeenCalled();
  });
  it("reports deferred storage cleanup after durable read revocation", async () => {
    doubles.deletion.mockRejectedValue(new Error("Offline storage"));
    expect(await replaceProfileAvatar({ actor, previousReference: "old", nextReference: null }, media)).toEqual({ cleanupPending: true });
    expect(doubles.mediaUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "DELETE_REQUESTED" }) }));
  });
  it("does not delete the winning pointer shared by identical concurrent uploads", async () => {
    await retireUnassociatedProfileAvatar(actor, "winner", media);
    expect(doubles.mediaUpdate).not.toHaveBeenCalled(); expect(doubles.deletion).not.toHaveBeenCalled();
  });
  it("retires a losing unassociated owned upload under the pointer lock", async () => {
    await retireUnassociatedProfileAvatar(actor, "loser", media);
    expect(doubles.mediaUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ publicReference: "loser", ownerId: actor.userId, status: "READY" }) }));
    expect(doubles.deletion).toHaveBeenCalledWith({ actor, reference: "loser" });
  });
  it("refuses attachment of already retired target media", async () => {
    doubles.mediaRead.mockResolvedValue(null);
    await expect(replaceProfileAvatar({ actor, previousReference: "old", nextReference: "retired" }, media)).rejects.toMatchObject({ code: "PROFILE_IMAGE_AUTHORITY_INVALID" });
    expect(doubles.mediaUpdate).not.toHaveBeenCalled(); expect(doubles.deletion).not.toHaveBeenCalled();
  });
  it.each([null, "same"])("does not retire a replayed pointer %s", async reference => {
    expect(await replaceProfileAvatar({ actor, previousReference: reference, nextReference: reference }, media)).toEqual({ cleanupPending: false });
    expect(doubles.mediaUpdate).not.toHaveBeenCalled(); expect(doubles.deletion).not.toHaveBeenCalled();
  });
});
