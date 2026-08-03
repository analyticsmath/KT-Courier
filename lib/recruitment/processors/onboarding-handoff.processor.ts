/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import { resolveRecruitmentProductionComposition } from "../composition-root";
import { OnboardingHandoffService } from "../onboarding-handoff.service";

export async function processOnboardingHandoffs() {
  const composition = resolveRecruitmentProductionComposition();
  if (composition.status === "LOCKED") {
    return { processed: 0, status: "LOCKED", code: composition.code };
  }

  const { repositories } = composition;
  const handoffService = new OnboardingHandoffService(repositories);

  const pendingHandoffs = await repositories.handoff.findMany({
    where: { status: "PENDING" },
  });

  let processed = 0;
  for (const h of pendingHandoffs) {
    try {
      await handoffService.processHandoff(h.publicReference);
      processed++;
    } catch {
      await repositories.handoff.update({
        where: { id: h.id },
        data: { status: "FAILED", failedAt: new Date() },
      });
    }
  }

  return { processed, status: "SUCCESS" };
}
