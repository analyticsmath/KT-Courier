/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 3 delegates are additive and are not generated in the checked-in Prisma client. */
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { DriverAvailability, DriverStatus, OrderAssignmentStatus, OrderStatus, UserRole, UserStatus } from "@/types/db";
import { prisma } from "@/lib/db/prisma";
import { rankDispatchCandidates } from "@/lib/dispatch/candidate-ranking";
import { evaluateDriverEligibility, type DispatchEligibilityReason } from "@/lib/dispatch/eligibility";
import { dispatchError } from "@/lib/dispatch/errors";
import { evaluateDispatchComplianceEvidence } from "@/lib/services/vehicle-compliance.service";

type Tx = Prisma.TransactionClient;
type DynamicDelegate = {
  findUnique(args: unknown): Promise<any>;
  findFirst(args: unknown): Promise<any>;
  create(args: unknown): Promise<any>;
  createMany?(args: unknown): Promise<any>;
  findMany(args: unknown): Promise<any>;
  updateMany(args: unknown): Promise<{ count: number }>;
};
type CandidateDatabase = {
  dispatchCandidateEvaluation: DynamicDelegate;
  dispatchCandidateEvidence: DynamicDelegate;
  marketplaceStoreOrderDeliveryBridge?: DynamicDelegate;
};

export type DispatchCandidateDisposition = "PENDING" | "SELECTED" | "REJECTED" | "EXPIRED" | "SUPERSEDED";
export type DispatchCandidateEvidenceDto = Readonly<{
  evidenceReference: string;
  driverProfileId: string;
  driverCode: string;
  displayName: string | null;
  eligible: boolean;
  reasonCodes: readonly DispatchEligibilityReason[];
  rank: number;
  distanceEvidenceType: "ROAD_PROVIDER" | "GEOMETRIC_HAVERSINE" | "UNAVAILABLE";
  distanceMeters: number | null;
  workload: Readonly<{ activeAssignments: number; capacity: number }>;
  availability: Readonly<{ state: string; updatedAt: string | null }>;
  regionMatch: boolean;
  restriction: Readonly<{ profileStatus: string; userStatus: string; userRole: string }>;
  dataFreshnessAt: string;
  disposition: DispatchCandidateDisposition;
}>;
export type DispatchCandidateEvaluationResult = Readonly<{
  evaluationReference: string;
  evaluationId: string;
  courierOrderId: string;
  operationId: string;
  policyVersion: string;
  pickupRegion: string | null;
  deliveryRegionId: string | null;
  requiredCapabilities: readonly string[];
  evaluatedAt: string;
  candidates: readonly DispatchCandidateEvidenceDto[];
  replayed: boolean;
}>;

function database(client: unknown): CandidateDatabase {
  return client as CandidateDatabase;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stable(item)]));
  }
  return value;
}

export function dispatchCandidateEvaluationRequestHash(input: Readonly<{
  courierOrderId: string;
  requestedDriverProfileId?: string;
  allowExistingAssignment?: boolean;
  excludeAssignmentId?: string;
}>): string {
  return createHash("sha256").update(JSON.stringify(stable(input))).digest("hex");
}

function reference(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDto(row: any): DispatchCandidateEvidenceDto {
  const driver = row.driverProfile ?? {};
  const reasons = Array.isArray(row.reasonCodes) ? row.reasonCodes.filter((value: unknown): value is DispatchEligibilityReason => typeof value === "string") : [];
  const workload = row.workloadEvidence as { activeAssignments?: unknown; capacity?: unknown } | null;
  const availability = row.availabilityEvidence as { state?: unknown; updatedAt?: unknown } | null;
  const restriction = row.restrictionEvidence as { profileStatus?: unknown; userStatus?: unknown; userRole?: unknown } | null;
  return Object.freeze({
    evidenceReference: String(row.publicReference),
    driverProfileId: String(row.driverProfileId),
    driverCode: String(driver.driverCode ?? ""),
    displayName: typeof driver.displayName === "string" ? driver.displayName : null,
    eligible: Boolean(row.eligible),
    reasonCodes: Object.freeze(reasons),
    rank: Number(row.deterministicRank),
    distanceEvidenceType: row.distanceEvidenceType as DispatchCandidateEvidenceDto["distanceEvidenceType"],
    distanceMeters: asNumber(row.distanceMeters),
    workload: Object.freeze({ activeAssignments: Number(workload?.activeAssignments ?? 0), capacity: Number(workload?.capacity ?? 1) }),
    availability: Object.freeze({ state: String(availability?.state ?? "UNKNOWN"), updatedAt: typeof availability?.updatedAt === "string" ? availability.updatedAt : null }),
    regionMatch: Boolean(row.regionMatch),
    restriction: Object.freeze({ profileStatus: String(restriction?.profileStatus ?? "UNKNOWN"), userStatus: String(restriction?.userStatus ?? "UNKNOWN"), userRole: String(restriction?.userRole ?? "UNKNOWN") }),
    dataFreshnessAt: new Date(row.dataFreshnessAt).toISOString(),
    disposition: row.disposition as DispatchCandidateDisposition,
  });
}

function toResult(row: any, replayed: boolean): DispatchCandidateEvaluationResult {
  return Object.freeze({
    evaluationReference: String(row.publicReference),
    evaluationId: String(row.id),
    courierOrderId: String(row.courierOrderId),
    operationId: String(row.operationId),
    policyVersion: String(row.policyVersion),
    pickupRegion: typeof row.pickupRegion === "string" ? row.pickupRegion : null,
    deliveryRegionId: typeof row.deliveryRegionId === "string" ? row.deliveryRegionId : null,
    requiredCapabilities: Object.freeze(Array.isArray(row.requiredCapabilities) ? row.requiredCapabilities.filter((value: unknown): value is string => typeof value === "string") : []),
    evaluatedAt: new Date(row.evaluatedAt).toISOString(),
    candidates: Object.freeze((row.candidates ?? []).map(toDto).sort((left: DispatchCandidateEvidenceDto, right: DispatchCandidateEvidenceDto) => left.rank - right.rank || left.driverCode.localeCompare(right.driverCode) || left.driverProfileId.localeCompare(right.driverProfileId))),
    replayed,
  });
}

async function policy(tx: Tx) {
  const rows = await tx.systemSetting.findMany({
    where: { key: { in: ["dispatch.policy_version", "dispatch.default_driver_capacity"] } },
  });
  const value = (key: string, fallback: string) => typeof rows.find((row) => row.key === key)?.value === "string"
    ? rows.find((row) => row.key === key)!.value as string
    : fallback;
  return {
    version: value("dispatch.policy_version", "dispatch-v1"),
    defaultCapacity: Math.min(10, Math.max(1, Number.parseInt(value("dispatch.default_driver_capacity", "1"), 10) || 1)),
  };
}

export async function createDispatchCandidateEvaluationInTx(
  tx: Tx,
  input: Readonly<{
    courierOrderId: string;
    operationId: string;
    requestedDriverProfileId?: string;
    allowExistingAssignment?: boolean;
    excludeAssignmentId?: string;
  }>,
): Promise<DispatchCandidateEvaluationResult> {
  const db = database(tx);
  const requestHash = dispatchCandidateEvaluationRequestHash(input);
  const existing = await db.dispatchCandidateEvaluation.findUnique({
    where: { operationId: input.operationId },
    include: { candidates: { include: { driverProfile: { select: { driverCode: true, displayName: true } } } } },
  });
  if (existing) {
    if (existing.courierOrderId !== input.courierOrderId || existing.requestHash !== requestHash) {
      throw dispatchError.driverIneligible("Dispatch evaluation operation ID was already used with different input.");
    }
    return toResult(existing, true);
  }

  const order = await tx.order.findUnique({
    where: { id: input.courierOrderId },
    select: { id: true, status: true, deliveryRegionId: true, pickupAddress: { select: { city: true } } },
  });
  if (!order) throw dispatchError.orderNotFound();
  const pickupEligibleStatuses: OrderStatus[] = [OrderStatus.CONFIRMED, OrderStatus.PICKUP_SCHEDULED];
  if (!pickupEligibleStatuses.includes(order.status)) throw dispatchError.orderNotAssignable();

  const activeAssignment = await tx.orderAssignment.findFirst({
    where: { orderId: order.id, activeOrderGuard: order.id },
    select: { id: true },
  });
  const [config, bridge, drivers, groupedAssignments] = await Promise.all([
    policy(tx),
    db.marketplaceStoreOrderDeliveryBridge?.findFirst({ where: { courierOrderId: order.id }, select: { marketplaceStoreOrderId: true, publicReference: true } }),
    tx.driverProfile.findMany({
      include: { user: { select: { status: true, role: true } }, serviceRegions: { select: { deliveryRegionId: true } }, documents: true, vehicles: { where: { status: "APPROVED", archivedAt: null }, include: { documents: true } } },
      orderBy: [{ driverCode: "asc" }, { id: "asc" }],
      take: 500,
    }),
    tx.orderAssignment.groupBy({
      by: ["driverProfileId"],
      where: {
        ...(input.excludeAssignmentId ? { id: { not: input.excludeAssignmentId } } : {}),
        status: { in: [OrderAssignmentStatus.ASSIGNED, OrderAssignmentStatus.ACCEPTED] },
        OR: [
          { status: OrderAssignmentStatus.ACCEPTED },
          { status: OrderAssignmentStatus.ASSIGNED, expiresAt: { gt: new Date() } },
          { status: OrderAssignmentStatus.ASSIGNED, expiresAt: null },
        ],
      },
      _count: { id: true },
    }),
  ]);
  const counts = new Map(groupedAssignments.map((row) => [row.driverProfileId, row._count.id]));
  const evaluatedAt = new Date();
  const evaluated = drivers.map((driver) => {
    const activeLoad = counts.get(driver.id) ?? 0;
    const regionMatch = Boolean(order.deliveryRegionId) && driver.serviceRegions.some((region) => region.deliveryRegionId === order.deliveryRegionId);
    const compliance = driver.vehicleComplianceRequiredAt ? evaluateDispatchComplianceEvidence({ driverDocuments: driver.documents, vehicles: driver.vehicles }) : { eligible: true, reasons: ["LEGACY_COMPLIANCE_CUTOVER_PENDING"], approvedVehicleId: null };
    const eligibility = evaluateDriverEligibility({
      userActive: driver.user.status === UserStatus.ACTIVE && driver.user.role === UserRole.DRIVER,
      profileActive: driver.status === DriverStatus.ACTIVE,
      available: driver.availability === DriverAvailability.AVAILABLE,
      regionMatch,
      activeLoad,
      capacity: driver.maxConcurrentAssignments || config.defaultCapacity,
      orderAlreadyAssigned: Boolean(activeAssignment) && !input.allowExistingAssignment,
      complianceEligible: compliance.eligible,
    });
    return { driver, activeLoad, regionMatch, eligibility };
  });
  const ranked = rankDispatchCandidates(evaluated.map(({ driver, activeLoad, regionMatch, eligibility }) => ({
    id: driver.id,
    driverCode: driver.driverCode,
    eligible: eligibility.eligible,
    regionMatch,
    vehicleMatch: true,
    activeLoad,
    capacity: driver.maxConcurrentAssignments || config.defaultCapacity,
    availabilityUpdatedAt: driver.availabilityUpdatedAt,
  })));
  const rank = new Map(ranked.map((candidate, index) => [candidate.id, index + 1]));
  const evaluation = await db.dispatchCandidateEvaluation.create({
    data: {
      publicReference: reference("dspeval"),
      courierOrderId: order.id,
      marketplaceStoreOrderId: bridge?.marketplaceStoreOrderId ?? null,
      deliveryBridgeReference: bridge?.publicReference ?? null,
      operationId: input.operationId,
      requestHash,
      policyVersion: config.version,
      pickupRegion: order.pickupAddress?.city ?? null,
      deliveryRegionId: order.deliveryRegionId,
      requiredCapabilities: [],
      evaluatedAt,
    },
  });
  for (const item of evaluated) {
    const freshness = item.driver.availabilityUpdatedAt ?? item.driver.updatedAt;
    await db.dispatchCandidateEvidence.create({
      data: {
        publicReference: reference("dspcandidate"),
        evaluationId: evaluation.id,
        driverProfileId: item.driver.id,
        eligible: item.eligibility.eligible,
        reasonCodes: item.eligibility.reasons,
        deterministicRank: rank.get(item.driver.id) ?? ranked.length + 1,
        distanceEvidenceType: "UNAVAILABLE",
        distanceMeters: null,
        workloadEvidence: { activeAssignments: item.activeLoad, capacity: item.eligibility.capacity },
        availabilityEvidence: { state: item.driver.availability, updatedAt: item.driver.availabilityUpdatedAt?.toISOString() ?? null },
        regionMatch: item.regionMatch,
        restrictionEvidence: { profileStatus: item.driver.status, userStatus: item.driver.user.status, userRole: item.driver.user.role },
        dataFreshnessAt: freshness,
        disposition: item.eligibility.eligible ? "PENDING" : "REJECTED",
        dispositionAt: item.eligibility.eligible ? null : evaluatedAt,
      },
    });
  }
  const completed = await db.dispatchCandidateEvaluation.findUnique({
    where: { id: evaluation.id },
    include: { candidates: { include: { driverProfile: { select: { driverCode: true, displayName: true } } } } },
  });
  if (!completed) throw new Error("Dispatch candidate evaluation was not persisted.");
  const result = toResult(completed, false);
  if (input.requestedDriverProfileId) {
    const requested = result.candidates.find((candidate) => candidate.driverProfileId === input.requestedDriverProfileId);
    if (!requested || !requested.eligible) throw dispatchError.driverIneligible(requested?.reasonCodes.join(", ") || "Selected driver is not eligible.");
  }
  return result;
}

export async function createDispatchCandidateEvaluation(input: Readonly<{
  courierOrderId: string;
  operationId: string;
}>): Promise<DispatchCandidateEvaluationResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${input.courierOrderId} FOR UPDATE`;
      return createDispatchCandidateEvaluationInTx(tx, input);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 });
  } catch (error) {
    if ((error as { code?: string })?.code !== "P2002") throw error;
    const existing = await database(prisma).dispatchCandidateEvaluation.findUnique({
      where: { operationId: input.operationId },
      include: { candidates: { include: { driverProfile: { select: { driverCode: true, displayName: true } } } } },
    });
    if (!existing) throw error;
    if (existing.courierOrderId !== input.courierOrderId || existing.requestHash !== dispatchCandidateEvaluationRequestHash(input)) {
      throw dispatchError.driverIneligible("Dispatch evaluation operation ID was already used with different input.");
    }
    return toResult(existing, true);
  }
}

export async function listLatestDispatchCandidateEvaluation(courierOrderId: string): Promise<DispatchCandidateEvaluationResult | null> {
  const row = await database(prisma).dispatchCandidateEvaluation.findFirst({
    where: { courierOrderId },
    include: { candidates: { include: { driverProfile: { select: { driverCode: true, displayName: true } } } } },
    orderBy: [{ evaluatedAt: "desc" }, { createdAt: "desc" }],
  });
  return row ? toResult(row, true) : null;
}

export async function selectDispatchCandidateInTx(tx: Tx, evaluationId: string, driverProfileId: string, assignmentId: string): Promise<void> {
  const db = database(tx);
  const now = new Date();
  const selected = await db.dispatchCandidateEvidence.updateMany({
    where: { evaluationId, driverProfileId, eligible: true, disposition: "PENDING" },
    data: { disposition: "SELECTED", dispositionAt: now, selectedAssignmentId: assignmentId },
  });
  if (selected.count !== 1) throw dispatchError.driverIneligible("Selected candidate evidence is no longer assignable.");
  await db.dispatchCandidateEvidence.updateMany({
    where: { evaluationId, driverProfileId: { not: driverProfileId }, disposition: "PENDING" },
    data: { disposition: "REJECTED", dispositionAt: now },
  });
}

export async function setDispatchCandidateDispositionForAssignmentInTx(tx: Tx, assignmentId: string, disposition: Exclude<DispatchCandidateDisposition, "PENDING" | "SELECTED">): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    UPDATE "DispatchCandidateEvidence"
    SET "disposition" = ${disposition}, "dispositionAt" = CURRENT_TIMESTAMP
    WHERE "selectedAssignmentId" = ${assignmentId}
      AND "disposition" = 'SELECTED'
  `);
}
