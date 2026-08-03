import type { NextRequest } from "next/server";
import { requirePromoterAdmin } from "./admin-api-policy";
import { db, promoterJson, safeRows } from "./route-support";

const DELEGATES: Record<string, string> = {
  promoters: "promoterAccount", "promoter-programs": "promoterProgram", "promoter-attributions": "promoterAttribution", "promoter-qualifications": "promoterQualification", "promoter-earnings": "promoterEarning", "promoter-fraud": "promoterFraudCase", "promoter-reconciliation": "promoterReconciliationCase", "promoter-disputes": "promoterDispute", "promoter-assets": "promoterMarketingAsset", "promoter-agreements": "promoterAgreementVersion",
};
export async function promoterAdminCollection(request: NextRequest, permission: string, resource: keyof typeof DELEGATES) {
  const auth = await requirePromoterAdmin(request, permission, `/api/admin/${resource}`); if ("response" in auth) return auth.response;
  const rows = await db[DELEGATES[resource]].findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return promoterJson({ [resource]: safeRows(rows) });
}
export async function promoterAdminDetail(request: NextRequest, permission: string, resource: keyof typeof DELEGATES, reference: string) {
  const auth = await requirePromoterAdmin(request, permission, `/api/admin/${resource}/[reference]`); if ("response" in auth) return auth.response;
  const row = await db[DELEGATES[resource]].findUnique({ where: { publicReference: reference } });
  return row ? promoterJson({ [resource.slice(0, -1)]: safeRows([row])[0] }) : promoterJson({ error: "Record was not found." }, 404);
}
