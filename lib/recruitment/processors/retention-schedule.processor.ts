/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client generation is deferred to Phase 26.5. */
import { resolveRecruitmentProductionComposition } from "../composition-root";

export async function processRetentionSchedule() {
  const composition = resolveRecruitmentProductionComposition();
  if (composition.status === "LOCKED") {
    return { processed: 0, status: "LOCKED", code: composition.code };
  }

  // Purge execution blocked until Phase 26.5
  return { processed: 0, status: "SUCCESS" };
}
