import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getFinanceDriverEarning } from "@/lib/services/driver-earning-query.service";
import { driverEarningApiError, driverEarningNoStoreJson } from "@/lib/driver-earnings/api-policy";
import { requireDriverEarningFinanceApiPermission } from "@/lib/driver-earnings/finance-permission";
import { DriverEarningIdParamsSchema } from "@/lib/validation/driver-earnings";
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const auth = await requireDriverEarningFinanceApiPermission(PERMISSIONS.DRIVER_EARNINGS_READ); if ("response" in auth) return auth.response; const parsed = DriverEarningIdParamsSchema.safeParse(await params); if (!parsed.success) return driverEarningNoStoreJson({ error: "Driver earning was not found." }, 404); try { const earning = await getFinanceDriverEarning(parsed.data.id); return earning ? driverEarningNoStoreJson({ earning }) : driverEarningNoStoreJson({ error: "Driver earning was not found." }, 404); } catch (error) { return driverEarningApiError(error); } }
