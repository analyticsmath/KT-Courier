 
import { resolveRecruitmentProductionComposition } from "../composition-root";

export async function processOfferExpiry() {
  const composition = resolveRecruitmentProductionComposition();
  if (composition.status === "LOCKED") {
    return { processed: 0, status: "LOCKED", code: composition.code };
  }

  const { repositories } = composition;
  const now = new Date();

  const expiredOfferVersions = await repositories.offerVersion.findMany({
    where: {
      status: "PUBLISHED",
      expiryAt: { lte: now },
    },
  });

  let processed = 0;
  for (const v of expiredOfferVersions) {
    await repositories.offerVersion.update({
      where: { id: v.id },
      data: { status: "RETIRED" },
    });

    await repositories.offer.update({
      where: { id: v.offerId },
      data: { status: "EXPIRED" },
    });

    processed++;
  }

  return { processed, status: "SUCCESS" };
}
