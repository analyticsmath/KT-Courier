import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertAcceptedCurrentDriver } from "@/lib/driver-operations/authority";
import { DriverOperationError } from "@/lib/driver-operations/errors";
import { completeOperationReceiptInTx, createOperationReceiptInTx, findOperationReplay, getCompletedOperationResult, isOperationReceiptConflict } from "@/lib/driver-operations/idempotency";
import { haversineKm } from "@/lib/maps/delivery-zone.service";
import type { DriverLocationSampleInput } from "@/lib/validation/driver-location";

type PriorLocation = Readonly<{
  latitude: Prisma.Decimal;
  longitude: Prisma.Decimal;
  clientCapturedAt: Date;
}>;

const MAX_SAMPLE_AGE_MS = 15 * 60 * 1_000;
const MAX_FUTURE_SKEW_MS = 2 * 60 * 1_000;
const POOR_ACCURACY_METERS = 100;
const MAX_SPEED_METERS_PER_SECOND = 50;
const DELIVERY_COMPLETION_MAX_SAMPLE_AGE_MS = 5 * 60 * 1_000;
const DELIVERY_COMPLETION_MAX_DISTANCE_METERS = 1_000;

function validationStatus(input: Readonly<{
  capturedAt: Date;
  now: Date;
  accuracyMeters: number | undefined;
  previous: PriorLocation | null;
  latitude: number;
  longitude: number;
  pickup: { latitude: Prisma.Decimal | null; longitude: Prisma.Decimal | null } | null;
  dropoff: { latitude: Prisma.Decimal | null; longitude: Prisma.Decimal | null } | null;
  orderStatus: string;
}>): string {
  if (input.capturedAt.getTime() < input.now.getTime() - MAX_SAMPLE_AGE_MS) return "STALE_TIMESTAMP";
  if (input.capturedAt.getTime() > input.now.getTime() + MAX_FUTURE_SKEW_MS) return "FUTURE_TIMESTAMP";
  if (input.previous && input.capturedAt <= input.previous.clientCapturedAt) return "OUT_OF_SEQUENCE";
  if (input.previous) {
    const distanceMeters = haversineKm(input.latitude, input.longitude, Number(input.previous.latitude), Number(input.previous.longitude)) * 1_000;
    const seconds = Math.max(1, (input.capturedAt.getTime() - input.previous.clientCapturedAt.getTime()) / 1_000);
    if (distanceMeters > Math.max(1_500, seconds * MAX_SPEED_METERS_PER_SECOND)) return "IMPLAUSIBLE_JUMP";
  }
  if (input.accuracyMeters !== undefined && input.accuracyMeters > POOR_ACCURACY_METERS) return "POOR_ACCURACY";
  if (input.orderStatus === "PICKUP_SCHEDULED" && input.pickup?.latitude && input.pickup.longitude) {
    if (haversineKm(input.latitude, input.longitude, Number(input.pickup.latitude), Number(input.pickup.longitude)) * 1_000 > 20_000) return "PICKUP_PROXIMITY_MISMATCH";
  }
  if (input.orderStatus === "DELIVERY_ATTEMPTED" && input.dropoff?.latitude && input.dropoff.longitude) {
    if (haversineKm(input.latitude, input.longitude, Number(input.dropoff.latitude), Number(input.dropoff.longitude)) * 1_000 > 1_000) return "DELIVERY_PROXIMITY_MISMATCH";
  }
  return "ACCEPTED";
}

/** Records point-in-time device evidence. The returned result intentionally has
 * no exact coordinate so it is safe for mobile status displays. */
export async function recordDriverLocationSample(
  assignmentId: string,
  driverProfileId: string,
  driverUserId: string,
  input: DriverLocationSampleInput,
): Promise<Readonly<{ reference: string; validationStatus: string; receivedAt: string }>> {
  const replay = await findOperationReplay(input.operationId, input);
  if (replay?.locationEvidenceReference && replay.locationValidationStatus) {
    return Object.freeze({
      reference: replay.locationEvidenceReference,
      validationStatus: replay.locationValidationStatus,
      receivedAt: replay.completedAt,
    });
  }
  const authority = await assertAcceptedCurrentDriver(assignmentId, driverProfileId, input.assignmentVersion);
  if (authority.driverUserId !== driverUserId) {
    throw new DriverOperationError("Only the assigned driver can record location evidence.", "DRIVER_OPERATION_FORBIDDEN");
  }
  const assignment = await prisma.orderAssignment.findFirst({
    where: { id: assignmentId, driverProfileId },
    select: {
      orderId: true,
      order: {
        select: {
          status: true,
          pickupAddress: { select: { latitude: true, longitude: true } },
          dropoffAddress: { select: { latitude: true, longitude: true } },
        },
      },
    },
  });
  if (!assignment || !["PICKUP_SCHEDULED", "PICKED_UP", "IN_TRANSIT", "DELIVERY_ATTEMPTED"].includes(assignment.order.status)) {
    throw new DriverOperationError("Location evidence is not accepted in the current delivery state.", "DRIVER_OPERATION_INVALID_STATE");
  }

  const receivedAt = new Date();
  const capturedAt = new Date(input.clientCapturedAt);
  const reference = `dloc_${randomUUID().replaceAll("-", "")}`;
  try {
    await prisma.$transaction(async (tx) => {
      await createOperationReceiptInTx(tx, {
        operationId: input.operationId,
        payload: input,
        orderId: assignment.orderId,
        assignmentId,
        driverProfileId,
        type: "LOCATION_SAMPLE",
      });
      const previousRows = await tx.$queryRaw<PriorLocation[]>(Prisma.sql`
        SELECT "latitude", "longitude", "clientCapturedAt"
        FROM "DriverLocationEvidence"
        WHERE "assignmentId" = ${assignmentId}
        ORDER BY "clientCapturedAt" DESC, "receivedAt" DESC
        LIMIT 1
        FOR UPDATE
      `);
      const status = validationStatus({
        capturedAt,
        now: receivedAt,
        accuracyMeters: input.accuracyMeters,
        previous: previousRows[0] ?? null,
        latitude: input.latitude,
        longitude: input.longitude,
        pickup: assignment.order.pickupAddress,
        dropoff: assignment.order.dropoffAddress,
        orderStatus: assignment.order.status,
      });
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "DriverLocationEvidence"
          ("id", "publicReference", "orderId", "assignmentId", "driverProfileId", "latitude", "longitude", "accuracyMeters", "headingDegrees", "speedMetersPerSecond", "source", "validationStatus", "clientCapturedAt", "receivedAt", "createdAt")
        VALUES
          (${`dloc_${randomUUID().replaceAll("-", "")}`}, ${reference}, ${assignment.orderId}, ${assignmentId}, ${driverProfileId}, ${input.latitude}, ${input.longitude}, ${input.accuracyMeters ?? null}, ${input.headingDegrees ?? null}, ${input.speedMetersPerSecond ?? null}, ${input.source}::"DriverLocationSource", ${status}::"DriverLocationValidationStatus", ${capturedAt}, ${receivedAt}, ${receivedAt})
      `);
      await completeOperationReceiptInTx(tx, input.operationId, {
        type: "LOCATION_SAMPLE",
        orderId: assignment.orderId,
        assignmentId,
        driverProfileId,
        orderStatus: assignment.order.status,
        assignmentStatus: authority.assignmentStatus,
        locationEvidenceReference: reference,
        locationValidationStatus: status,
        completedAt: receivedAt.toISOString(),
      });
    });
  } catch (error) {
    if (isOperationReceiptConflict(error)) {
      const resolved = await getCompletedOperationResult(input.operationId);
      if (resolved?.locationEvidenceReference && resolved.locationValidationStatus) {
        return Object.freeze({ reference: resolved.locationEvidenceReference, validationStatus: resolved.locationValidationStatus, receivedAt: resolved.completedAt });
      }
    }
    throw error;
  }
  const completed = await getCompletedOperationResult(input.operationId);
  if (!completed?.locationEvidenceReference || !completed.locationValidationStatus) {
    throw new DriverOperationError("Location evidence receipt was not completed.", "DRIVER_OPERATION_STALE");
  }
  return Object.freeze({ reference: completed.locationEvidenceReference, validationStatus: completed.locationValidationStatus, receivedAt: completed.completedAt });
}

export async function getLatestSafeDriverLocationProjection(
  assignmentId: string,
  driverProfileId: string,
): Promise<Readonly<{ observedAt: string; validationStatus: string; latitude: number; longitude: number }> | null> {
  const rows = await prisma.$queryRaw<Array<Readonly<{ latitude: Prisma.Decimal; longitude: Prisma.Decimal; receivedAt: Date; validationStatus: string }>>>(Prisma.sql`
    SELECT "latitude", "longitude", "receivedAt", "validationStatus"
    FROM "DriverLocationEvidence"
    WHERE "assignmentId" = ${assignmentId} AND "driverProfileId" = ${driverProfileId} AND "validationStatus" = 'ACCEPTED'
    ORDER BY "receivedAt" DESC
    LIMIT 1
  `);
  const latest = rows[0];
  if (!latest) return null;
  return Object.freeze({
    observedAt: latest.receivedAt.toISOString(),
    validationStatus: latest.validationStatus,
    latitude: Math.round(Number(latest.latitude) * 100) / 100,
    longitude: Math.round(Number(latest.longitude) * 100) / 100,
  });
}

type DeliveryCompletionLocationRow = Readonly<{
  latitude: Prisma.Decimal;
  longitude: Prisma.Decimal;
  accuracyMeters: Prisma.Decimal | null;
  source: string;
  validationStatus: string;
  clientCapturedAt: Date;
  receivedAt: Date;
  dropoffLatitude: Prisma.Decimal | null;
  dropoffLongitude: Prisma.Decimal | null;
}>;

export type VerifiedDeliveryLocation = Readonly<{
  latitude: number;
  longitude: number;
  capturedAt: Date;
}>;

type LocationEvidenceTransaction = Pick<Prisma.TransactionClient, "$queryRaw">;

/**
 * Completion can use only freshly recorded device evidence. Command payload
 * coordinates are deliberately not accepted because they cannot establish a
 * trustworthy delivery geofence on their own.
 */
export async function requireVerifiedDeliveryLocationInTx(
  tx: LocationEvidenceTransaction,
  input: Readonly<{ orderId: string; assignmentId: string; driverProfileId: string; now?: Date }>,
): Promise<VerifiedDeliveryLocation> {
  const now = input.now ?? new Date();
  const rows = await tx.$queryRaw<DeliveryCompletionLocationRow[]>(Prisma.sql`
    SELECT evidence."latitude", evidence."longitude", evidence."accuracyMeters",
      evidence."source", evidence."validationStatus", evidence."clientCapturedAt", evidence."receivedAt",
      dropoff."latitude" AS "dropoffLatitude", dropoff."longitude" AS "dropoffLongitude"
    FROM "DriverLocationEvidence" evidence
    JOIN "Order" courier_order ON courier_order."id" = evidence."orderId"
    LEFT JOIN "Address" dropoff ON dropoff."id" = courier_order."dropoffAddressId"
    WHERE evidence."orderId" = ${input.orderId}
      AND evidence."assignmentId" = ${input.assignmentId}
      AND evidence."driverProfileId" = ${input.driverProfileId}
    ORDER BY evidence."clientCapturedAt" DESC, evidence."receivedAt" DESC
    LIMIT 1
    FOR UPDATE OF evidence
  `);
  const location = rows[0];
  if (!location) {
    throw new DriverOperationError("A recent verified delivery-location sample is required before completion.", "DRIVER_OPERATION_INVALID_STATE");
  }
  if (
    location.validationStatus !== "ACCEPTED" ||
    location.source !== "DEVICE_GPS" ||
    !location.accuracyMeters ||
    Number(location.accuracyMeters) > POOR_ACCURACY_METERS ||
    now.getTime() - location.clientCapturedAt.getTime() > DELIVERY_COMPLETION_MAX_SAMPLE_AGE_MS ||
    location.clientCapturedAt.getTime() > now.getTime() + MAX_FUTURE_SKEW_MS ||
    !location.dropoffLatitude ||
    !location.dropoffLongitude
  ) {
    throw new DriverOperationError("Delivery location evidence is unavailable or cannot be verified.", "DRIVER_OPERATION_INVALID_STATE");
  }
  const distanceMeters = haversineKm(
    Number(location.latitude),
    Number(location.longitude),
    Number(location.dropoffLatitude),
    Number(location.dropoffLongitude),
  ) * 1_000;
  if (distanceMeters > DELIVERY_COMPLETION_MAX_DISTANCE_METERS) {
    throw new DriverOperationError("Verified location evidence is not near the delivery destination.", "DRIVER_OPERATION_INVALID_STATE");
  }
  return Object.freeze({
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
    capturedAt: location.clientCapturedAt,
  });
}
