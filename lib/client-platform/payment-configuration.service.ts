import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/auth/permissions";
import type { AuthenticatedUser } from "@/types/domain";
import { PROVINCES, PlatformError } from "./contracts";
import {
  paymentPolicyScope,
  resolvePaymentBreakdown,
} from "@/lib/payments/payment-policy.service";
import { createCashOnDeliveryObligationWithinTransaction } from "@/lib/services/cash-on-delivery.service";
const amount = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/)
  .refine(
    (v) => new Prisma.Decimal(v).gt(0) && new Prisma.Decimal(v).lte(1000000),
  );
export const PaymentConfigurationSchema = z
  .object({
    storeId: z.string().cuid().nullable(),
    deliveryServiceId: z
      .string()
      .regex(/^CLIENT_[A-Z0-9_]{2,40}$/)
      .nullable(),
    provinces: z
      .array(z.enum(PROVINCES))
      .min(1)
      .max(9)
      .refine((v) => new Set(v).size === v.length)
      .nullable(),
    regionId: z.string().cuid().nullable(),
    orderId: z.string().cuid().nullable(),
    mode: z.enum(["DIGITAL", "FULL_COD", "DEPOSIT_PLUS_COD"]),
    depositPercent: z
      .string()
      .regex(/^0\.\d{1,4}$/)
      .refine((v) => new Prisma.Decimal(v).gt(0) && new Prisma.Decimal(v).lt(1))
      .nullable(),
    maximumCodAmount: amount.nullable(),
    active: z.boolean(),
    expectedVersion: z.number().int().nonnegative(),
    reason: z.string().trim().min(10).max(500),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.mode !== "DIGITAL" && (!v.storeId || !v.maximumCodAmount))
      c.addIssue({
        code: "custom",
        message: "Cash requires an approved business and positive cash limit.",
      });
    if (v.mode === "DEPOSIT_PLUS_COD" && !v.depositPercent)
      c.addIssue({
        code: "custom",
        message: "Configure the online deposit percentage.",
      });
    if (v.mode !== "DEPOSIT_PLUS_COD" && v.depositPercent)
      c.addIssue({
        code: "custom",
        message: "A deposit percentage applies only to deposit-plus-cash.",
      });
    if (v.orderId && !v.storeId)
      c.addIssue({
        code: "custom",
        message: "Order overrides must identify the business.",
      });
  });
async function authorize(u: AuthenticatedUser) {
  if (
    u.status !== "ACTIVE" ||
    !["ADMIN", "SUPER_ADMIN"].includes(u.role) ||
    !(await hasPermission({
      userId: u.id,
      role: u.role,
      permissionKey: "cod_operations.manage",
    }))
  )
    throw new PlatformError(
      "PAYMENT_CONFIGURATION_FORBIDDEN",
      "Cash operations permission is required.",
      403,
    );
}
export async function listPaymentConfigurations(u: AuthenticatedUser) {
  await authorize(u);
  const [policies, stores, services, regions] = await Promise.all([
    prisma.paymentMethodPolicy.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.store.findMany({
      where: {
        status: "ACTIVE",
        ownerUser: { status: "ACTIVE", emailVerifiedAt: { not: null } },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 1000,
    }),
    prisma.deliveryServiceDefinition.findMany({
      where: { stableKey: { startsWith: "CLIENT_" }, status: "ACTIVE" },
      select: { stableKey: true, displayName: true },
      distinct: ["stableKey"],
      orderBy: { versionNumber: "desc" },
    }),
    prisma.deliveryRegion.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const latest = new Map<string, number>();
  for (const p of policies)
    latest.set(
      paymentPolicyScope(p),
      Math.max(latest.get(paymentPolicyScope(p)) ?? 0, p.versionNumber),
    );
  return {
    policies: policies.map((p) => ({
      id: p.id,
      storeId: p.storeId,
      deliveryServiceId: p.deliveryServiceId,
      provinces: Array.isArray(p.provinceScope)
        ? (p.provinceScope as string[])
        : null,
      regionId: p.regionId,
      orderId: p.orderId,
      mode: p.mode,
      depositPercent: p.depositPercent?.toString() ?? null,
      maximumCodAmount: p.maximumCodAmount?.toFixed(2) ?? null,
      active:
        p.status === "ACTIVE" && (!p.effectiveTo || p.effectiveTo > new Date()),
      expectedVersion: p.versionNumber,
      editable: latest.get(paymentPolicyScope(p)) === p.versionNumber,
      createdAt: p.createdAt.toISOString(),
    })),
    stores,
    services,
    regions,
  };
}
export async function savePaymentConfiguration(
  u: AuthenticatedUser,
  input: z.infer<typeof PaymentConfigurationSchema>,
) {
  await authorize(u);
  input = PaymentConfigurationSchema.parse(input);
  const scope = {
    businessModuleId: null,
    storeId: input.storeId,
    deliveryServiceId: input.deliveryServiceId,
    orderType: null,
    provinceScope: input.provinces,
    regionId: input.regionId,
    orderId: input.orderId,
  };
  const key = paymentPolicyScope(scope);
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment-policy:${key}`}))`;
      if (input.storeId) {
        const s = await tx.store.findUnique({
          where: { id: input.storeId },
          select: {
            status: true,
            ownerUser: { select: { status: true, emailVerifiedAt: true } },
          },
        });
        if (
          s?.status !== "ACTIVE" ||
          s.ownerUser?.status !== "ACTIVE" ||
          !s.ownerUser.emailVerifiedAt
        )
          throw new PlatformError(
            "COD_BUSINESS_NOT_APPROVED",
            "Select an active approved business with a verified owner.",
            422,
          );
      }
      if (
        input.deliveryServiceId &&
        !(await tx.deliveryServiceDefinition.findFirst({
          where: {
            stableKey: input.deliveryServiceId,
            status: "ACTIVE",
            effectiveFrom: { lte: new Date() },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
          },
        }))
      )
        throw new PlatformError(
          "PAYMENT_SERVICE_UNAVAILABLE",
          "Select an available service.",
          422,
        );
      if (
        input.regionId &&
        !(await tx.deliveryRegion.findFirst({
          where: { id: input.regionId, active: true },
        }))
      )
        throw new PlatformError(
          "PAYMENT_REGION_UNAVAILABLE",
          "Select an active region.",
          422,
        );
      const existing = (
        await tx.paymentMethodPolicy.findMany({
          where: { storeId: input.storeId },
        })
      ).filter((p) => paymentPolicyScope(p) === key);
      const version = Math.max(0, ...existing.map((p) => p.versionNumber));
      if (version !== input.expectedVersion)
        throw new PlatformError(
          "PAYMENT_CONFIGURATION_CHANGED",
          "Reload before saving this policy scope.",
          409,
        );
      const now = new Date();
      await tx.paymentMethodPolicy.updateMany({
        where: { id: { in: existing.map((p) => p.id) }, status: "ACTIVE" },
        data: { status: "SUPERSEDED", effectiveTo: now },
      });
      const row = await tx.paymentMethodPolicy.create({
        data: {
          ...scope,
          provinceScope: input.provinces ?? Prisma.DbNull,
          versionNumber: version + 1,
          status: input.active ? "ACTIVE" : "INACTIVE",
          mode: input.mode,
          depositPercent: input.depositPercent
            ? new Prisma.Decimal(input.depositPercent)
            : null,
          maximumCodAmount:
            input.mode !== "DIGITAL" && input.maximumCodAmount
              ? new Prisma.Decimal(input.maximumCodAmount)
              : null,
          effectiveFrom: now,
          createdByUserId: u.id,
          policyEvidence: { reason: input.reason, actualActorUserId: u.id },
        },
      });
      if (input.orderId && input.active) {
        await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`;
        const o = await tx.order.findUnique({
          where: { id: input.orderId },
          include: {
            cashOnDelivery: true,
            payments: { select: { id: true } },
            pricingQuote: true,
            pickupAddress: true,
            dropoffAddress: true,
          },
        });
        if (!o || o.storeId !== input.storeId)
          throw new PlatformError(
            "PAYMENT_ORDER_NOT_FOUND",
            "Order does not belong to this business.",
            404,
          );
        if (
          !["PENDING", "CONFIRMED", "PICKUP_SCHEDULED"].includes(o.status) ||
          o.payments.length ||
          (o.cashOnDelivery && !o.cashOnDelivery.cashCollected.isZero()) ||
          (o.cashOnDelivery && !o.cashOnDelivery.digitalPaid.isZero()) ||
          !o.pricingQuote ||
          !o.priceEstimate?.equals(o.pricingQuote.total)
        )
          throw new PlatformError(
            "PAYMENT_ORDER_LOCKED",
            "Policy cannot change after payment preparation, collection or pickup.",
            409,
          );
        const rule = o.pricingQuote.ruleSnapshot as {
          serviceKey?: string;
          configurationId?: string;
        };
        const b = await resolvePaymentBreakdown(
          {
            storeId: o.storeId,
            deliveryServiceId: rule.configurationId,
            deliveryServiceKey: rule.serviceKey,
            orderType: o.deliveryType,
            provinces: [
              o.pickupAddress?.province,
              o.dropoffAddress?.province,
            ].filter((v): v is string => !!v),
            regionId: o.pricingQuote.destinationRegionId,
            orderId: o.id,
            authoritativeTotal: o.pricingQuote.total.toFixed(2),
          },
          tx,
        );
        const snapshot = o.pricingSnapshot;
        if (
          !snapshot ||
          typeof snapshot !== "object" ||
          Array.isArray(snapshot)
        )
          throw new PlatformError(
            "PAYMENT_ORDER_LOCKED",
            "Pricing evidence is incomplete.",
            409,
          );
        await tx.order.update({
          where: { id: o.id },
          data: {
            pricingSnapshot: {
              ...snapshot,
              paymentPolicy: {
                ...b.policyEvidence,
                digitalRequired: b.digitalRequired,
                cashRequired: b.cashRequired,
              },
            },
          },
        });
        if (b.mode === "DIGITAL_ONLY") {
          if (o.cashOnDelivery)
            await tx.cashOnDelivery.delete({
              where: { id: o.cashOnDelivery.id },
            });
        } else if (o.cashOnDelivery)
          await tx.cashOnDelivery.update({
            where: { id: o.cashOnDelivery.id },
            data: {
              policyMode: b.mode,
              authoritativePayable: new Prisma.Decimal(b.authoritativeTotal),
              digitalRequired: new Prisma.Decimal(b.digitalRequired),
              cashObligation: new Prisma.Decimal(b.cashRequired),
              status:
                b.mode === "FULL_COD" ? "READY_FOR_COLLECTION" : "PENDING",
              version: { increment: 1 },
              events: {
                create: {
                  operationId: `policy:${row.id}`,
                  requestHash: row.id,
                  eventType: "COMMITTED",
                  actorUserId: u.id,
                  safeEvidence: { ...b.policyEvidence, reason: input.reason },
                },
              },
            },
          });
        else
          await createCashOnDeliveryObligationWithinTransaction(tx, {
            orderId: o.id,
            policyMode: b.mode,
            authoritativePayable: b.authoritativeTotal,
            digitalRequired: b.digitalRequired,
            policyEvidence: b.policyEvidence,
          });
      }
      await tx.adminActivityLog.create({
        data: {
          actorUserId: u.id,
          action: "UPDATE",
          entityType: "PaymentMethodPolicy",
          entityId: row.id,
          message:
            input.orderId && input.active
              ? "Unpaid order payment policy updated"
              : "Scoped payment policy version saved",
          metadata: {
            reason: input.reason,
            storeId: input.storeId,
            orderId: input.orderId,
            version: version + 1,
            mode: input.mode,
            active: input.active,
          },
        },
      });
      return { id: row.id, version: version + 1 };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
