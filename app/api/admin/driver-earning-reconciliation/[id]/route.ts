import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getDriverEarningReconciliation } from "@/lib/services/driver-earning-query.service";
import { driverEarningApiError, driverEarningNoStoreJson } from "@/lib/driver-earnings/api-policy";
import { requireDriverEarningFinanceApiPermission } from "@/lib/driver-earnings/finance-permission";
import { DriverEarningReconciliationParamsSchema } from "@/lib/validation/driver-earnings";
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const auth = await requireDriverEarningFinanceApiPermission(PERMISSIONS.DRIVER_EARNINGS_RECONCILE); if ("response" in auth) return auth.response; const parsed = DriverEarningReconciliationParamsSchema.safeParse(await params); if (!parsed.success) return driverEarningNoStoreJson({ error: "Driver earning reconciliation was not found." }, 404); try { const reconciliation = await getDriverEarningReconciliation(parsed.data.id); return reconciliation ? driverEarningNoStoreJson({ reconciliation }) : driverEarningNoStoreJson({ error: "Driver earning reconciliation was not found." }, 404); } catch (error) { return driverEarningApiError(error); } }
