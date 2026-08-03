import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listDriverEarningsForOwner } from "@/lib/services/driver-earning-query.service";
import { driverEarningApiError, driverEarningNoStoreJson } from "@/lib/driver-earnings/api-policy";
import { DriverEarningListQuerySchema, driverEarningSearchParams } from "@/lib/validation/driver-earnings";
export async function GET(request: NextRequest) { const user = await getCurrentUser(); if (!user) return driverEarningNoStoreJson({ error: "Authentication required." }, 401); if (user.role !== "DRIVER" || user.status !== "ACTIVE") return driverEarningNoStoreJson({ error: "Driver earnings are unavailable for this account." }, 403); const parsed = DriverEarningListQuerySchema.safeParse(driverEarningSearchParams(request.nextUrl.searchParams)); if (!parsed.success) return driverEarningNoStoreJson({ error: "Invalid driver earning filters." }, 422); try { return driverEarningNoStoreJson(await listDriverEarningsForOwner(user.id, parsed.data)); } catch (error) { return driverEarningApiError(error); } }
