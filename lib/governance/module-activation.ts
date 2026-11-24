import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

export const GOVERNED_MODULES = Object.freeze({
  REPORTING: {
    key: "REPORTING" as const,
    settingKey: "reporting.production_activation_approval",
    lockReason: "REPORTING_CONSOLIDATED_VALIDATION_NOT_APPROVED" as const,
    label: "Reporting & CSV Exports Production Activation",
  },
  DEVELOPER_API: {
    key: "DEVELOPER_API" as const,
    settingKey: "developer_api.production_activation_approval",
    lockReason: "DEVELOPER_API_CONSOLIDATED_VALIDATION_NOT_APPROVED" as const,
    label: "Developer API & Outbound Webhooks Production Activation",
  },
});

export type GovernedModuleKey = keyof typeof GOVERNED_MODULES;

export const ModuleActivationRecordSchema = z
  .object({
    status: z.enum(["DRAFT_REQUESTED", "APPROVED", "REVOKED"]),
    requestedByUserId: z.string().min(1),
    requestedAt: z.string().datetime(),
    reason: z.string().trim().min(10).max(500),
    approvedByUserId: z.string().min(1).nullable(),
    approvedAt: z.string().datetime().nullable(),
    approvalNote: z.string().trim().min(1).max(500).nullable(),
    revokedByUserId: z.string().min(1).nullable(),
    revokedAt: z.string().datetime().nullable(),
    version: z.number().int().positive(),
  })
  .strict();

export type ModuleActivationRecord = z.infer<typeof ModuleActivationRecordSchema>;

export const ModuleActivationRequestSchema = z
  .object({
    moduleKey: z.enum(["REPORTING", "DEVELOPER_API"]),
    expectedVersion: z.number().int().min(0),
    reason: z.string().trim().min(10).max(500),
  })
  .strict();

export const ModuleActivationReviewSchema = z
  .object({
    moduleKey: z.enum(["REPORTING", "DEVELOPER_API"]),
    expectedVersion: z.number().int().positive(),
    action: z.enum(["APPROVE", "REVOKE"]),
    reason: z.string().trim().min(10).max(500),
  })
  .strict();

export class ModuleActivationError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: 400 | 403 | 409 | 422 | 423 | 503,
    message: string,
  ) {
    super(message);
    this.name = "ModuleActivationError";
  }
}

export type GovernedModuleActivationState = Readonly<{
  moduleKey: GovernedModuleKey;
  settingKey: string;
  approved: boolean;
  runtimeConfigured: boolean;
  active: boolean;
  status: "UNREQUESTED" | "DRAFT_REQUESTED" | "APPROVED" | "REVOKED";
  version: number;
  requestedByUserId: string | null;
  requestedAt: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  reason: string | null;
  blockerCode: string | null;
  summary: string;
  recordExists: boolean;
}>;

export type ActivationDbClient = Readonly<{
  systemSetting?: {
    findUnique?: (args: { where: { key: string }; select?: { value: true; updatedAt: true } }) => Promise<{ value: unknown; updatedAt?: Date } | null>;
  };
}>;

export function evaluateGovernedActivationRecord(
  moduleKey: GovernedModuleKey,
  rawValue: unknown,
  runtime: Readonly<{ configured: boolean; blockerCode: string; summary: string }>,
  now = new Date(),
): GovernedModuleActivationState {
  const spec = GOVERNED_MODULES[moduleKey];
  const baseFail = (
    status: GovernedModuleActivationState["status"],
    version: number,
    recordExists: boolean,
    fields?: Partial<ModuleActivationRecord>,
    blockerCode: string = spec.lockReason,
    summary = `${spec.label} requires independent dual-control admin approval and valid runtime configuration.`,
  ): GovernedModuleActivationState =>
    Object.freeze({
      moduleKey,
      settingKey: spec.settingKey,
      approved: false,
      runtimeConfigured: runtime.configured,
      active: false,
      status,
      version,
      requestedByUserId: fields?.requestedByUserId ?? null,
      requestedAt: fields?.requestedAt ?? null,
      approvedByUserId: fields?.approvedByUserId ?? null,
      approvedAt: fields?.approvedAt ?? null,
      reason: fields?.reason ?? null,
      blockerCode,
      summary,
      recordExists,
    });

  if (rawValue === null || rawValue === undefined) {
    return baseFail("UNREQUESTED", 0, false);
  }

  const parsed = ModuleActivationRecordSchema.safeParse(rawValue);
  if (!parsed.success) {
    return baseFail(
      "UNREQUESTED",
      0,
      true,
      undefined,
      spec.lockReason,
      `${spec.label} approval record is malformed; failing closed.`,
    );
  }

  const record = parsed.data;
  if (record.status === "DRAFT_REQUESTED") {
    return baseFail(
      "DRAFT_REQUESTED",
      record.version,
      true,
      record,
      spec.lockReason,
      `${spec.label} activation draft is awaiting independent reviewer approval.`,
    );
  }
  if (record.status === "REVOKED") {
    return baseFail(
      "REVOKED",
      record.version,
      true,
      record,
      spec.lockReason,
      `${spec.label} activation has been revoked by an administrator.`,
    );
  }

  const nowMs = now.getTime();
  const requestedAtMs = Date.parse(record.requestedAt);
  const approvedAtMs = record.approvedAt ? Date.parse(record.approvedAt) : Number.NaN;
  const isValidApproval =
    Boolean(record.approvedByUserId) &&
    record.approvedByUserId !== record.requestedByUserId &&
    Number.isFinite(requestedAtMs) &&
    Number.isFinite(approvedAtMs) &&
    requestedAtMs <= approvedAtMs &&
    approvedAtMs <= nowMs &&
    record.revokedAt === null &&
    record.revokedByUserId === null;

  if (!isValidApproval) {
    return baseFail(
      "UNREQUESTED",
      record.version,
      true,
      record,
      spec.lockReason,
      `${spec.label} approval record failed maker-checker or timestamp verification.`,
    );
  }

  const active = runtime.configured;
  return Object.freeze({
    moduleKey,
    settingKey: spec.settingKey,
    approved: true,
    runtimeConfigured: runtime.configured,
    active,
    status: "APPROVED",
    version: record.version,
    requestedByUserId: record.requestedByUserId,
    requestedAt: record.requestedAt,
    approvedByUserId: record.approvedByUserId,
    approvedAt: record.approvedAt,
    reason: record.reason,
    blockerCode: active ? null : runtime.blockerCode,
    summary: active
      ? `${spec.label} is independently approved and runtime-configured.`
      : runtime.summary,
    recordExists: true,
  });
}

export async function readGovernedModuleActivation(
  moduleKey: GovernedModuleKey,
  runtime: Readonly<{ configured: boolean; blockerCode: string; summary: string }>,
  options: Readonly<{ db?: ActivationDbClient; now?: Date }> = {},
): Promise<GovernedModuleActivationState> {
  const spec = GOVERNED_MODULES[moduleKey];
  const dbClient = options.db ?? prisma;
  if (typeof dbClient?.systemSetting?.findUnique !== "function") {
    return evaluateGovernedActivationRecord(moduleKey, null, runtime, options.now ?? new Date());
  }
  const row = await dbClient.systemSetting.findUnique({
    where: { key: spec.settingKey },
    select: { value: true, updatedAt: true },
  });
  return evaluateGovernedActivationRecord(
    moduleKey,
    row?.value ?? null,
    runtime,
    options.now ?? new Date(),
  );
}

export async function requestModuleActivation(
  actorUserId: string,
  rawInput: unknown,
  options: Readonly<{ runtimeCheck: () => Readonly<{ configured: boolean; blockerCode: string; summary: string }>; now?: Date }> ,
): Promise<GovernedModuleActivationState> {
  const parsed = ModuleActivationRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ModuleActivationError(
      "MODULE_ACTIVATION_REQUEST_INVALID",
      422,
      parsed.error.issues[0]?.message ?? "Invalid module activation request.",
    );
  }
  const { moduleKey, expectedVersion, reason } = parsed.data;
  const spec = GOVERNED_MODULES[moduleKey];
  const now = options.now ?? new Date();
  const runtime = options.runtimeCheck();
  if (!runtime.configured) {
    throw new ModuleActivationError(runtime.blockerCode, 422, runtime.summary);
  }

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`module-activation:${spec.settingKey}`}))`;
      const currentRow = await tx.systemSetting.findUnique({ where: { key: spec.settingKey } });
      const currentParsed = currentRow?.value ? ModuleActivationRecordSchema.safeParse(currentRow.value) : null;
      const currentVersion = currentParsed?.success ? currentParsed.data.version : 0;
      if (currentVersion !== expectedVersion) {
        throw new ModuleActivationError(
          "MODULE_ACTIVATION_VERSION_CONFLICT",
          409,
          "Module activation state changed. Reload and retry.",
        );
      }
      if (currentParsed?.success && currentParsed.data.status === "APPROVED") {
        throw new ModuleActivationError(
          "MODULE_ACTIVATION_ALREADY_APPROVED",
          409,
          "Module activation is already approved; revoke it before submitting a new request.",
        );
      }

      const nextRecord: ModuleActivationRecord = {
        status: "DRAFT_REQUESTED",
        requestedByUserId: actorUserId,
        requestedAt: now.toISOString(),
        reason,
        approvedByUserId: null,
        approvedAt: null,
        approvalNote: null,
        revokedByUserId: null,
        revokedAt: null,
        version: currentVersion + 1,
      };

      await tx.systemSetting.upsert({
        where: { key: spec.settingKey },
        create: {
          key: spec.settingKey,
          label: spec.label,
          type: "JSON",
          value: nextRecord as unknown as Prisma.InputJsonValue,
        },
        update: {
          label: spec.label,
          value: nextRecord as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.adminActivityLog.create({
        data: {
          actorUserId: actorUserId,
          action: "UPDATE",
          entityType: "SystemSetting",
          entityId: spec.settingKey,
          message: `${spec.label} activation requested`,
          metadata: { moduleKey, event: "REQUEST_ACTIVATION", version: nextRecord.version, status: nextRecord.status, reason },
        },
      });

      return evaluateGovernedActivationRecord(moduleKey, nextRecord, runtime, now);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function reviewModuleActivation(
  reviewerUserId: string,
  rawInput: unknown,
  options: Readonly<{ runtimeCheck: () => Readonly<{ configured: boolean; blockerCode: string; summary: string }>; now?: Date }>,
): Promise<GovernedModuleActivationState> {
  const parsed = ModuleActivationReviewSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ModuleActivationError(
      "MODULE_ACTIVATION_REVIEW_INVALID",
      422,
      parsed.error.issues[0]?.message ?? "Invalid module activation review.",
    );
  }
  const { moduleKey, expectedVersion, action, reason } = parsed.data;
  const spec = GOVERNED_MODULES[moduleKey];
  const now = options.now ?? new Date();
  const runtime = options.runtimeCheck();
  if (action === "APPROVE" && !runtime.configured) {
    throw new ModuleActivationError(runtime.blockerCode, 422, runtime.summary);
  }

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`module-activation:${spec.settingKey}`}))`;
      const currentRow = await tx.systemSetting.findUnique({ where: { key: spec.settingKey } });
      const currentParsed = currentRow?.value ? ModuleActivationRecordSchema.safeParse(currentRow.value) : null;
      if (!currentParsed?.success) {
        throw new ModuleActivationError(
          "MODULE_ACTIVATION_DRAFT_MISSING",
          409,
          "Submit a valid activation request draft before independent review.",
        );
      }
      const current = currentParsed.data;
      if (current.version !== expectedVersion) {
        throw new ModuleActivationError(
          "MODULE_ACTIVATION_VERSION_CONFLICT",
          409,
          "Module activation state changed. Reload and retry.",
        );
      }

      if (action === "APPROVE") {
        if (current.status !== "DRAFT_REQUESTED") {
          throw new ModuleActivationError(
            "MODULE_ACTIVATION_NOT_PENDING",
            409,
            "Only a pending activation request draft can be approved.",
          );
        }
        if (current.requestedByUserId === reviewerUserId) {
          throw new ModuleActivationError(
            "MODULE_ACTIVATION_SELF_APPROVAL_FORBIDDEN",
            403,
            "An independent second administrator must approve module activation.",
          );
        }
      } else if (current.status === "REVOKED") {
        throw new ModuleActivationError(
          "MODULE_ACTIVATION_ALREADY_REVOKED",
          409,
          "Module activation is already revoked.",
        );
      }

      const nowIso = now.toISOString();
      const nextRecord: ModuleActivationRecord =
        action === "APPROVE"
          ? {
              ...current,
              status: "APPROVED",
              approvedByUserId: reviewerUserId,
              approvedAt: nowIso,
              approvalNote: reason,
              revokedByUserId: null,
              revokedAt: null,
              version: current.version + 1,
            }
          : {
              ...current,
              status: "REVOKED",
              revokedByUserId: reviewerUserId,
              revokedAt: nowIso,
              version: current.version + 1,
            };

      await tx.systemSetting.upsert({
        where: { key: spec.settingKey },
        create: {
          key: spec.settingKey,
          label: spec.label,
          type: "JSON",
          value: nextRecord as unknown as Prisma.InputJsonValue,
        },
        update: {
          label: spec.label,
          value: nextRecord as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.adminActivityLog.create({
        data: {
          actorUserId: reviewerUserId,
          action: "UPDATE",
          entityType: "SystemSetting",
          entityId: spec.settingKey,
          message: `${spec.label} ${action.toLowerCase()}`,
          metadata: { moduleKey, event: action === "APPROVE" ? "APPROVE_ACTIVATION" : "REVOKE_ACTIVATION", action, version: nextRecord.version, reason },
        },
      });

      return evaluateGovernedActivationRecord(moduleKey, nextRecord, runtime, now);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
