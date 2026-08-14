import { prisma } from "@/lib/db/prisma";
import { getLatestSafeDriverLocationProjection } from "./driver-location-evidence.service";
import { recordAdminActivity } from "./admin-activity.service";
import { resolveRetentionPolicy } from "@/lib/retention/privacy-retention.service";
import { evaluateRetentionHolds } from "@/lib/retention/hold-evaluator";

const ACTIVE_ORDER_STATUSES = ["PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT", "DELIVERY_ATTEMPTED"];
export type LocationPurpose = "DISPATCH" | "ACTIVE_DELIVERY_TRACKING" | "DELIVERY_PROOF" | "SAFETY_INCIDENT" | "OPERATIONAL_SUPPORT";
export class LocationAccessError extends Error { constructor(readonly code: string) { super(code); this.name = "LocationAccessError"; } }

export async function resolveLocationAccess(input: { actorUserId: string; actorRole: string; orderId: string; purpose: LocationPurpose; privileged?: boolean }) {
  const client = prisma as any;
  const order = await client.order.findUnique({ where: { id: input.orderId }, include: { store: { select: { ownerUserId: true } }, assignments: { where: { status: { in: ["ACCEPTED", "ASSIGNED"] } }, orderBy: { assignedAt: "desc" }, take: 1, select: { id: true, driverProfileId: true } } } });
  if (!order) throw new LocationAccessError("LOCATION_ORDER_NOT_FOUND");
  const active = ACTIVE_ORDER_STATUSES.includes(String(order.status));
  const customer = order.customerId === input.actorUserId;
  const store = order.store?.ownerUserId === input.actorUserId;
  const admin = input.actorRole === "ADMIN" || input.actorRole === "SUPER_ADMIN";
  if (!admin && !customer && !store) throw new LocationAccessError("LOCATION_ACCESS_DENIED");
  if (!input.privileged && !active) throw new LocationAccessError("LOCATION_LIVE_SCOPE_EXPIRED");
  const assignment = order.assignments[0]; if (!assignment) return { order, assignment: null, active, projection: null };
  const projection = await getLatestSafeDriverLocationProjection(assignment.id, assignment.driverProfileId);
  if (admin && input.privileged) await recordAdminActivity({ actorUserId: input.actorUserId, action: "VIEW", entityType: "DriverLocationEvidence", entityId: assignment.id, message: "Accessed authorised location evidence", metadata: { orderId: input.orderId, purpose: input.purpose, historical: !active } });
  return { order, assignment, active, projection };
}

export async function resolveLocationRetention(input: { driverProfileId: string }) {
  const [hold, policy] = await Promise.all([evaluateRetentionHolds({ subjectType: "Driver", subjectReference: input.driverProfileId }), resolveRetentionPolicy("LOCATION_DATA").catch(() => null)]);
  return { held: hold.hasHold, holdReason: hold.activeHoldReason ?? null, policy };
}
