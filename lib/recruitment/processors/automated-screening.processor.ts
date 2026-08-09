 
import { resolveRecruitmentProductionComposition } from "../composition-root";
import { ScreeningService } from "../screening.service";

export async function processAutomatedScreening() {
  const composition = resolveRecruitmentProductionComposition();
  if (composition.status === "LOCKED") {
    return { processed: 0, status: "LOCKED", code: composition.code };
  }

  const { repositories } = composition;
  const screeningService = new ScreeningService(repositories);

  const appsForScreening = await repositories.application.findMany({
    where: { status: "COMPLETENESS_REVIEW" },
  });

  let processed = 0;
  for (const app of appsForScreening) {
    const { outcome } = await screeningService.evaluateObjectiveScreening(app.id);

    let nextState = "ELIGIBILITY_REVIEW";
    if (outcome === "POTENTIAL_INELIGIBILITY") {
      nextState = "INELIGIBLE_PENDING_CONFIRMATION";
    }

    await repositories.application.update({
      where: { id: app.id },
      data: { status: nextState, currentStage: nextState },
    });

    processed++;
  }

  return { processed, status: "SUCCESS" };
}
