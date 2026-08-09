 
import { resolveRecruitmentProductionComposition } from "../composition-root";

export async function processInterviewExpiry() {
  const composition = resolveRecruitmentProductionComposition();
  if (composition.status === "LOCKED") {
    return { processed: 0, status: "LOCKED", code: composition.code };
  }

  const { repositories } = composition;
  const now = new Date();

  const expiredSlots = await repositories.interviewSlot.findMany({
    where: {
      endTime: { lte: now },
      bookedCount: 0,
    },
  });

  let processed = 0;
  for (const slot of expiredSlots) {
    await repositories.interviewSlot.delete({
      where: { id: slot.id },
    });
    processed++;
  }

  return { processed, status: "SUCCESS" };
}
