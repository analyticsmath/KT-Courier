import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type HandoverOtpStage = "PICKUP" | "DELIVERY";

/**
 * The canonical driver operation receipt binds an OTP to its issuance stage.
 * Never infer OTP purpose from the recipient address or order status: a
 * historical pickup OTP can outlive collection in older shipments.
 *
 * Match the immutable createdOtpId and the accepted assignment, rather than
 * relying on a client-submitted stage label.
 */
export async function isIssuedOtpForStage(
  orderId: string,
  otpId: string,
  assignmentId: string | null,
  stage: HandoverOtpStage,
  db: Prisma.TransactionClient = prisma,
): Promise<boolean> {
  if (!otpId || !orderId || !assignmentId) return false;
  const command = await db.driverOperationCommand.findFirst({
    where: {
      orderId,
      assignmentId,
      type: stage === "PICKUP" ? "PICKUP_OTP_REQUEST" : "DELIVERY_OTP_REQUEST",
      completedAt: { not: null },
      resultSnapshot: { path: ["createdOtpId"], equals: otpId },
    },
    select: { id: true },
  });
  return Boolean(command);
}
