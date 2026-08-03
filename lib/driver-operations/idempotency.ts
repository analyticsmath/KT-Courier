import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/types/db";
import { DriverOperationError } from "./errors";
import type { DriverOperationType } from "./types";

export type DriverOperationSnapshot = {
  type: DriverOperationType;
  orderId: string;
  assignmentId: string;
  driverProfileId: string;
  orderStatus: string;
  assignmentStatus: string;
  createdAttemptId?: string;
  createdPodId?: string;
  completedAt: string;
};

type StoredCommand = {
  operationId: string;
  requestHash: string;
  resultSnapshot: DriverOperationSnapshot | null;
  completedAt: Date | null;
};

type CommandClient = {
  driverOperationCommand: {
    findUnique(args: { where: { operationId: string }; select: { operationId: true; requestHash: true; resultSnapshot: true; completedAt: true } }): Promise<StoredCommand | null>;
    create(args: { data: { operationId: string; orderId: string; assignmentId: string; driverProfileId: string; type: string; requestHash: string } }): Promise<unknown>;
    update(args: { where: { operationId: string }; data: { resultSnapshot: Prisma.InputJsonValue; completedAt: Date } }): Promise<unknown>;
    deleteMany(args: { where: { operationId: string; completedAt: null } }): Promise<{ count: number }>;
  };
};

function commandClient(client: unknown): CommandClient {
  return client as CommandClient;
}

export async function reserveOperation(
  args: { operationId: string; payload: unknown; orderId: string; assignmentId: string; driverProfileId: string; type: DriverOperationType }
): Promise<void> {
  await commandClient(prisma).driverOperationCommand.create({
    data: { operationId: args.operationId, orderId: args.orderId, assignmentId: args.assignmentId, driverProfileId: args.driverProfileId, type: args.type, requestHash: driverOperationRequestHash(args.payload) },
  });
}

export async function completeReservedOperation(operationId: string, snapshot: DriverOperationSnapshot): Promise<void> {
  await commandClient(prisma).driverOperationCommand.update({ where: { operationId }, data: { resultSnapshot: snapshot as unknown as Prisma.InputJsonValue, completedAt: new Date() } });
}

export async function abandonReservedOperation(operationId: string): Promise<void> {
  await commandClient(prisma).driverOperationCommand.deleteMany({ where: { operationId, completedAt: null } });
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key, item]) => item !== undefined && key !== "otpCode")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

/** OTP plaintext is deliberately excluded. The code is re-verified only inside
 * the command transaction and is never persisted in receipt data or hashes. */
export function driverOperationRequestHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(payload))).digest("hex");
}

export async function findOperationReplay(operationId: string, payload: unknown): Promise<DriverOperationSnapshot | null> {
  const existing = await commandClient(prisma).driverOperationCommand.findUnique({
    where: { operationId },
    select: { operationId: true, requestHash: true, resultSnapshot: true, completedAt: true },
  });
  if (!existing) return null;
  if (existing.requestHash !== driverOperationRequestHash(payload)) {
    throw new DriverOperationError("This operation ID was already used with different request data.", "DRIVER_OPERATION_IDEMPOTENCY_CONFLICT");
  }
  if (!existing.completedAt || !existing.resultSnapshot) {
    throw new DriverOperationError("This operation is still being processed. Retry shortly.", "DRIVER_OPERATION_STALE");
  }
  return existing.resultSnapshot;
}

export async function getCompletedOperationResult(operationId: string): Promise<DriverOperationSnapshot | null> {
  const command = await commandClient(prisma).driverOperationCommand.findUnique({ where: { operationId }, select: { operationId: true, requestHash: true, resultSnapshot: true, completedAt: true } });
  return command?.completedAt && command.resultSnapshot ? command.resultSnapshot : null;
}

export function isOperationReceiptConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2002";
}

export async function createOperationReceiptInTx(
  tx: Prisma.TransactionClient,
  args: { operationId: string; payload: unknown; orderId: string; assignmentId: string; driverProfileId: string; type: DriverOperationType }
): Promise<void> {
  const { payload, ...receipt } = args;
  await commandClient(tx).driverOperationCommand.create({
    data: { ...receipt, requestHash: driverOperationRequestHash(payload) },
  });
}

export async function completeOperationReceiptInTx(
  tx: Prisma.TransactionClient,
  operationId: string,
  snapshot: DriverOperationSnapshot
): Promise<void> {
  await commandClient(tx).driverOperationCommand.update({
    where: { operationId },
    data: { resultSnapshot: snapshot as unknown as Prisma.InputJsonValue, completedAt: new Date() },
  });
}
