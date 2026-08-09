 
import { resolveRecruitmentProductionComposition } from "../composition-root";

export async function processApplicationCompleteness() {
  const composition = resolveRecruitmentProductionComposition();
  if (composition.status === "LOCKED") {
    return { processed: 0, status: "LOCKED", code: composition.code };
  }

  const { repositories } = composition;

  const submittedApplications = await repositories.application.findMany({
    where: { status: "SUBMITTED" },
    include: { answers: true, documents: true },
  });

  let processed = 0;
  for (const app of submittedApplications) {
    await repositories.application.update({
      where: { id: app.id },
      data: { status: "COMPLETENESS_REVIEW", currentStage: "COMPLETENESS_REVIEW" },
    });
    processed++;
  }

  return { processed, status: "SUCCESS" };
}
