import { prisma } from "@/lib/db/prisma";
import { PrivateMediaPolicyError, PrivateMediaService, type PrivateMediaActor } from "@/lib/private-media/private-media.service";

/** The pointer and read revocation commit together. Provider deletion is a
 * separate recoverable boundary; DELETE_REQUESTED objects cannot be served. */
export async function replaceProfileAvatar(input: { actor: PrivateMediaActor; previousReference: string | null; nextReference: string | null }, media: PrivateMediaService) {
  await prisma.$transaction(async tx => {
    const changed = await tx.user.updateMany({ where: { id: input.actor.userId, avatarMediaReference: input.previousReference }, data: { avatarMediaReference: input.nextReference } });
    if (changed.count !== 1) throw new PrivateMediaPolicyError("PROFILE_IMAGE_CHANGED", 409, "Your profile image changed. Refresh before retrying.");
    if (input.previousReference && input.previousReference !== input.nextReference) {
      const retired = await tx.privateMediaObject.updateMany({ where: { publicReference: input.previousReference, ownerType: "USER", ownerId: input.actor.userId, purpose: "OTHER", status: { in: ["READY", "RETAINED", "DELETE_REQUESTED", "DELETED"] } }, data: { status: "DELETE_REQUESTED", deleteRequestedAt: new Date(), version: { increment: 1 } } });
      if (retired.count !== 1) throw new PrivateMediaPolicyError("PROFILE_IMAGE_AUTHORITY_INVALID", 409, "The previous profile image could not be safely retired.");
    }
  });
  if (!input.previousReference || input.previousReference === input.nextReference) return { cleanupPending: false };
  try {
    await media.requestDeletion({ actor: input.actor, reference: input.previousReference });
    return { cleanupPending: false };
  } catch {
    // Read revocation already committed. Keep the durable deletion request for
    // operator recovery even when the storage or final database write fails.
    return { cleanupPending: true };
  }
}
