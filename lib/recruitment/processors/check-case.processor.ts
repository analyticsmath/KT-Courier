/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import { resolveRecruitmentProductionComposition } from "../composition-root";

export async function processCheckCases() {
  const composition = resolveRecruitmentProductionComposition();
  if (composition.status === "LOCKED") {
    return { processed: 0, status: "LOCKED", code: composition.code };
  }

  const { repositories } = composition;

  const readyCases = await repositories.checkCase.findMany({
    where: { status: "READY" },
  });

  let processed = 0;
  for (const c of readyCases) {
    await repositories.checkCase.update({
      where: { id: c.id },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });
    processed++;
  }

  return { processed, status: "SUCCESS" };
}
