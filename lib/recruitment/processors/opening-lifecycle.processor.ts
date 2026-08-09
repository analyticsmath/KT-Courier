 
import { resolveRecruitmentProductionComposition } from "../composition-root";

export async function processOpeningLifecycle() {
  const composition = resolveRecruitmentProductionComposition();
  if (composition.status === "LOCKED") {
    return { processed: 0, status: "LOCKED", code: composition.code };
  }

  const { repositories } = composition;
  const now = new Date();

  const expiredVersions = await repositories.openingVersion.findMany({
    where: {
      status: "PUBLISHED",
      applicationClosesAt: { lte: now },
    },
  });

  let processed = 0;
  for (const version of expiredVersions) {
    await repositories.openingVersion.update({
      where: { id: version.id },
      data: { status: "RETIRED", retiredAt: now },
    });
    processed++;
  }

  return { processed, status: "SUCCESS" };
}
