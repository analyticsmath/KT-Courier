import { getCurrentUser } from "@/lib/auth/current-user";
import { getDriverEarningSummaryForOwner } from "@/lib/services/driver-earning-summary.service";
import { driverEarningApiError, driverEarningNoStoreJson } from "@/lib/driver-earnings/api-policy";
export async function GET() { const user = await getCurrentUser(); if (!user) return driverEarningNoStoreJson({ error: "Authentication required." }, 401); if (user.role !== "DRIVER" || user.status !== "ACTIVE") return driverEarningNoStoreJson({ error: "Driver earnings are unavailable for this account." }, 403); try { return driverEarningNoStoreJson({ summary: await getDriverEarningSummaryForOwner(user.id) }); } catch (error) { return driverEarningApiError(error); } }
