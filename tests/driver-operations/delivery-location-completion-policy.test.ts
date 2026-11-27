import { afterEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { requireVerifiedDeliveryLocationInTx } from "@/lib/services/driver-location-evidence.service";
import { DriverLocationSampleSchema, QaSimulatedLocationCommandSchema } from "@/lib/validation/driver-location";

const validSimulatedRow = {
  latitude: -26.1076,
  longitude: 28.0567,
  accuracyMeters: 10,
  source: "QA_SIMULATED",
  validationStatus: "ACCEPTED",
  clientCapturedAt: new Date(),
  receivedAt: new Date(),
  dropoffLatitude: -26.1076,
  dropoffLongitude: 28.0567,
  isQaAcceptance: true,
};

function makeQaTx(row: Record<string, unknown>, overrides?: {
  orderRun?: { id: string; status: string; driverProfileId: string | null } | null;
  principal?: Record<string, unknown> | null;
  driverProfileId?: string;
}) {
  const driverProfileId = overrides?.driverProfileId ?? "driver-qa-1";
  return {
    $queryRaw: vi.fn().mockResolvedValue([row]),
    order: {
      findUnique: vi.fn().mockResolvedValue({
        id: "order-qa-1",
        isQaAcceptance: Boolean(row.isQaAcceptance),
        qaAcceptanceRunId: "run-qa-1",
      }),
    },
    driverProfile: {
      findUnique: vi.fn().mockResolvedValue({
        id: driverProfileId,
        isQaAcceptance: true,
        userId: "user-qa-driver-1",
        user: { status: "ACTIVE", role: "DRIVER", isQaAcceptance: true },
      }),
    },
    qaAcceptancePrincipal: {
      findFirst: vi.fn().mockResolvedValue(
        overrides?.principal === undefined
          ? {
              id: "prin-qa-1",
              publicReference: "QAP-DRV-1",
              userId: "user-qa-driver-1",
              role: "DRIVER",
              storeId: null,
              driverProfileId,
              label: "QA Driver",
              user: { status: "ACTIVE", role: "DRIVER", isQaAcceptance: true },
              store: null,
              driverProfile: { id: driverProfileId, isQaAcceptance: true },
            }
          : overrides.principal,
      ),
    },
    qaAcceptanceRun: {
      findMany: vi.fn().mockResolvedValue([
        overrides?.orderRun ?? {
          id: "run-qa-1",
          publicReference: "QARUN-1",
          storeId: null,
          customerUserId: null,
          driverProfileId,
          startedAt: new Date(),
        },
      ]),
      findUnique: vi.fn().mockResolvedValue(
        overrides?.orderRun === undefined
          ? { id: "run-qa-1", status: "ACTIVE", driverProfileId }
          : overrides.orderRun,
      ),
    },
  } as unknown as Prisma.TransactionClient;
}

describe("delivery completion location policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed when no fresh verified device evidence exists", async () => {
    const tx: Pick<Prisma.TransactionClient, "$queryRaw"> = { $queryRaw: vi.fn().mockResolvedValue([]) };
    await expect(requireVerifiedDeliveryLocationInTx(tx, {
      orderId: "order-1",
      assignmentId: "assignment-1",
      driverProfileId: "driver-1",
    })).rejects.toMatchObject({ code: "DRIVER_OPERATION_INVALID_STATE" });
  });

  it("rejects DRIVER_MANUAL location evidence even at dropoff coordinates", async () => {
    const tx: Pick<Prisma.TransactionClient, "$queryRaw"> = {
      $queryRaw: vi.fn().mockResolvedValue([{
        ...validSimulatedRow,
        source: "DRIVER_MANUAL",
        isQaAcceptance: false,
      }]),
    };
    await expect(requireVerifiedDeliveryLocationInTx(tx, {
      orderId: "order-comm-1",
      assignmentId: "assignment-1",
      driverProfileId: "driver-comm-1",
    })).rejects.toMatchObject({ code: "DRIVER_OPERATION_INVALID_STATE" });
  });

  it("accepts genuine DEVICE_GPS on commercial shipments with isQaSimulated: false", async () => {
    const tx: Pick<Prisma.TransactionClient, "$queryRaw"> = {
      $queryRaw: vi.fn().mockResolvedValue([{
        ...validSimulatedRow,
        source: "DEVICE_GPS",
        isQaAcceptance: false,
      }]),
    };
    const verified = await requireVerifiedDeliveryLocationInTx(tx, {
      orderId: "order-comm-1",
      assignmentId: "assignment-1",
      driverProfileId: "driver-comm-1",
    });
    expect(verified.source).toBe("DEVICE_GPS");
    expect(verified.isQaSimulated).toBe(false);
  });

  it("blocks QA_SIMULATED evidence from completing commercial orders", async () => {
    vi.stubEnv("QA_ACCEPTANCE_LANE_ENABLED", "true");
    vi.stubEnv("PAYSTACK_ACCEPTANCE_SANDBOX_SECRET_KEY", ["sk", "test", "policy_unit_secret_0123456"].join("_"));
    const tx: Pick<Prisma.TransactionClient, "$queryRaw"> = {
      $queryRaw: vi.fn().mockResolvedValue([{
        ...validSimulatedRow,
        source: "QA_SIMULATED",
        isQaAcceptance: false,
      }]),
    };
    await expect(requireVerifiedDeliveryLocationInTx(tx, {
      orderId: "order-comm-1",
      assignmentId: "assignment-1",
      driverProfileId: "driver-comm-1",
    })).rejects.toMatchObject({ code: "DRIVER_OPERATION_FORBIDDEN" });
  });

  it("blocks client-supplied coordinates in QA simulation commands and spoofing QA_SIMULATED in telemetry", () => {
    const base = {
      operationId: "123e4567-e89b-12d3-a456-426614174000",
      assignmentVersion: 1,
    };
    expect(QaSimulatedLocationCommandSchema.safeParse({ ...base, mode: "QA_SIMULATED" }).success).toBe(true);
    expect(QaSimulatedLocationCommandSchema.safeParse({ ...base, mode: "QA_SIMULATED", latitude: -26.1, longitude: 28.0 }).success).toBe(false);
    expect(DriverLocationSampleSchema.safeParse({
      ...base,
      latitude: -26.1,
      longitude: 28.0,
      clientCapturedAt: "2026-11-27T10:00:00.000Z",
      source: "QA_SIMULATED",
    }).success).toBe(false);
  });

  it("accepts QA_SIMULATED for active enrolled QA driver and matching run, while rejecting archived/wrong/revoked runs", async () => {
    vi.stubEnv("QA_ACCEPTANCE_LANE_ENABLED", "true");
    vi.stubEnv("PAYSTACK_ACCEPTANCE_SANDBOX_SECRET_KEY", ["sk", "test", "policy_unit_secret_0123456"].join("_"));

    const activeTx = makeQaTx(validSimulatedRow);
    const verified = await requireVerifiedDeliveryLocationInTx(activeTx, {
      orderId: "order-qa-1",
      assignmentId: "assignment-qa-1",
      driverProfileId: "driver-qa-1",
    });
    expect(verified.source).toBe("QA_SIMULATED");
    expect(verified.isQaSimulated).toBe(true);

    const archivedTx = makeQaTx(validSimulatedRow, {
      orderRun: { id: "run-qa-1", status: "ARCHIVED", driverProfileId: "driver-qa-1" },
    });
    await expect(requireVerifiedDeliveryLocationInTx(archivedTx, {
      orderId: "order-qa-1",
      assignmentId: "assignment-qa-1",
      driverProfileId: "driver-qa-1",
    })).rejects.toMatchObject({ code: "DRIVER_OPERATION_FORBIDDEN" });

    const wrongRunTx = makeQaTx(validSimulatedRow, {
      orderRun: { id: "run-qa-1", status: "ACTIVE", driverProfileId: "driver-qa-other" },
    });
    await expect(requireVerifiedDeliveryLocationInTx(wrongRunTx, {
      orderId: "order-qa-1",
      assignmentId: "assignment-qa-1",
      driverProfileId: "driver-qa-1",
    })).rejects.toMatchObject({ code: "DRIVER_OPERATION_FORBIDDEN" });

    const revokedPrincipalTx = makeQaTx(validSimulatedRow, { principal: null });
    await expect(requireVerifiedDeliveryLocationInTx(revokedPrincipalTx, {
      orderId: "order-qa-1",
      assignmentId: "assignment-qa-1",
      driverProfileId: "driver-qa-1",
    })).rejects.toMatchObject({ code: "DRIVER_OPERATION_FORBIDDEN" });
  });
});
