 
import { resolveRecruitmentProductionComposition } from "../composition-root";
import { RecruitmentReconciliationService } from "../reconciliation.service";

export async function processRecruitmentReconciliation() {
  const composition = resolveRecruitmentProductionComposition();
  if (composition.status === "LOCKED") {
    return { processed: 0, status: "LOCKED", code: composition.code };
  }

  const { repositories } = composition;
  const reconciliationService = new RecruitmentReconciliationService(repositories);

  const cases = await reconciliationService.runReconciliationScan();
  return { processed: cases.length, status: "SUCCESS" };
}
