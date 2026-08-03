import { prisma } from "@/lib/db/prisma";
import { toAdminPodDto, toPublicPodDto, type AdminPodDto, type PublicPodDto } from "@/lib/dto/delivery.dto";

const POD_WITH_DRIVER = {
  driverProfile: { select: { driverCode: true, displayName: true } },
} as const;

// ─── Admin: fetch POD for a given order ──────────────────────────────────────

export async function getAdminPodForOrder(orderId: string): Promise<AdminPodDto | null> {
  const pod = await prisma.proofOfDelivery.findUnique({
    where: { orderId },
    include: POD_WITH_DRIVER,
  });
  return pod ? toAdminPodDto(pod) : null;
}

// ─── Customer/store: fetch safe POD ──────────────────────────────────────────

export async function getPublicPodForOrder(orderId: string): Promise<PublicPodDto | null> {
  const pod = await prisma.proofOfDelivery.findUnique({
    where: { orderId },
    include: POD_WITH_DRIVER,
  });
  return pod ? toPublicPodDto(pod) : null;
}
