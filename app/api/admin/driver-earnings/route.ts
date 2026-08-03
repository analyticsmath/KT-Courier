import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listFinanceDriverEarnings } from "@/lib/services/driver-earning-query.service";
import { driverEarningApiError, driverEarningNoStoreJson } from "@/lib/driver-earnings/api-policy";
import { requireDriverEarningFinanceApiPermission } from "@/lib/driver-earnings/finance-permission";
import { FinanceDriverEarningListQuerySchema, driverEarningSearchParams } from "@/lib/validation/driver-earnings";
export async function GET(request: NextRequest) { const auth = await requireDriverEarningFinanceApiPermission(PERMISSIONS.DRIVER_EARNINGS_READ); if ("response" in auth) return auth.response; const parsed = FinanceDriverEarningListQuerySchema.safeParse(driverEarningSearchParams(request.nextUrl.searchParams)); if (!parsed.success) return driverEarningNoStoreJson({ error: "Invalid driver earning filters." }, 422); try { return driverEarningNoStoreJson(await listFinanceDriverEarnings(parsed.data)); } catch (error) { return driverEarningApiError(error); } }
