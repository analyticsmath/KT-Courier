import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { MarketplaceCheckoutError } from "./errors";
import { PlatformError } from "@/lib/client-platform/contracts";

export const MARKETPLACE_COURIER_TARIFF_POLICY_KEY = "production_marketplace_courier_tariff_policy";
export const OWNER_COURIER_TARIFF_APPROVAL = "OWNER_SELECTED_EXISTING_COURIER_TARIFFS_2026_10_14";
export const MarketplaceCourierTariffPolicySchema = z.object({
  enabled: z.boolean(),
  defaultServiceKey: z.string().regex(/^CLIENT_[A-Z0-9_]{2,40}$/),
  approvalReference: z.string().min(10).max(200),
}).strict();
const policySchema = MarketplaceCourierTariffPolicySchema;
export const CourierTariffConfigurationSchema = policySchema.omit({ approvalReference: true }).extend({ expectedUpdatedAt: z.iso.datetime().nullable(), reason: z.string().trim().min(10).max(500) }).strict();

export async function marketplaceCourierTariffConfiguration() {
  const row = await prisma.systemSetting.findUnique({ where: { key: MARKETPLACE_COURIER_TARIFF_POLICY_KEY } });
  return row ? { ...policySchema.parse(row.value), updatedAt: row.updatedAt.toISOString() } : { enabled: false, defaultServiceKey: "CLIENT_ECONOMY", approvalReference: "MATRIX_POLICY", updatedAt: null };
}

export async function saveMarketplaceCourierTariffConfiguration(actorUserId: string, input: z.infer<typeof CourierTariffConfigurationSchema>) {
  const data = CourierTariffConfigurationSchema.parse(input);
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${MARKETPLACE_COURIER_TARIFF_POLICY_KEY}))`;
    const prior = await tx.systemSetting.findUnique({ where: { key: MARKETPLACE_COURIER_TARIFF_POLICY_KEY } });
    if ((prior?.updatedAt.toISOString() ?? null) !== data.expectedUpdatedAt) throw new PlatformError("VERSION_CONFLICT", "Marketplace pricing changed. Refresh before saving.", 409);
    if (data.enabled && !await tx.deliveryServiceDefinition.findFirst({ where: { stableKey: data.defaultServiceKey, status: "ACTIVE", effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] }, select: { id: true } })) throw new PlatformError("SERVICE_UNAVAILABLE", "Choose an active courier service before enabling this pricing model.", 422);
    const value = { enabled: data.enabled, defaultServiceKey: data.defaultServiceKey, approvalReference: `ADMIN_CONFIGURED:${actorUserId}` };
    const row = await tx.systemSetting.upsert({ where: { key: MARKETPLACE_COURIER_TARIFF_POLICY_KEY }, create: { key: MARKETPLACE_COURIER_TARIFF_POLICY_KEY, type: "JSON", label: "Marketplace delivery pricing model", value }, update: { value } });
    await tx.adminActivityLog.create({ data: { actorUserId, action: prior ? "UPDATE" : "CREATE", entityType: "MarketplaceCourierTariffPolicy", entityId: row.id, message: data.reason, metadata: { enabled: data.enabled, defaultServiceKey: data.defaultServiceKey, priorUpdatedAt: data.expectedUpdatedAt, newTariffsAuthored: false } } });
    return { ...value, updatedAt: row.updatedAt.toISOString() };
  });
}

/** Absence preserves the independently reviewed matrix model. */
export async function marketplaceCourierTariffPolicy() {
  const row = await prisma.systemSetting.findUnique({ where: { key: MARKETPLACE_COURIER_TARIFF_POLICY_KEY }, select: { value: true } });
  if (!row) return null;
  const parsed = policySchema.safeParse(row.value);
  if (!parsed.success) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Marketplace courier pricing needs administrator configuration.");
  return parsed.data.enabled ? parsed.data : null;
}

export async function activateOwnerSelectedCourierTariffs(actorUserId: string) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${MARKETPLACE_COURIER_TARIFF_POLICY_KEY}))`;
    const prior = await tx.systemSetting.findUnique({ where: { key: MARKETPLACE_COURIER_TARIFF_POLICY_KEY } });
    const value = { enabled: true, defaultServiceKey: "CLIENT_ECONOMY", approvalReference: OWNER_COURIER_TARIFF_APPROVAL };
    if (prior) {
      const existing = policySchema.parse(prior.value);
      if (!existing.enabled || existing.defaultServiceKey !== value.defaultServiceKey || existing.approvalReference !== value.approvalReference) throw new Error("Marketplace courier pricing was changed; no automatic overwrite.");
      return { activated: false };
    }
    const row = await tx.systemSetting.create({ data: { key: MARKETPLACE_COURIER_TARIFF_POLICY_KEY, type: "JSON", label: "Marketplace delivery pricing model", value } });
    await tx.adminActivityLog.create({ data: { actorUserId, action: "CREATE", entityType: "MarketplaceCourierTariffPolicy", entityId: row.id, message: "Owner selected existing courier tariffs for marketplace delivery; Economy is the initial default as in public quotes.", metadata: { ...value, authorizedMaintenance: true, inventedFees: false } } });
    return { activated: true };
  });
}
