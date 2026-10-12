import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db/prisma";

export async function reviewedProtectedRowAudit() {
  const report: Record<string, unknown> = { event: "kt_reviewed_production_evidence", at: new Date().toISOString(), readOnly: true };
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    const identity = await tx.$queryRaw<Array<{ database: string; role: string; transactionReadOnly: string }>>`SELECT current_database() AS database, current_user AS role, current_setting('transaction_read_only') AS "transactionReadOnly"`;
    report.database = identity[0];
    const protectedRows: Record<string, unknown> = {};
    for (const name of ["User", "Store", "Address", "Order", "Payment", "MarketplaceOrder", "MarketplaceStoreOrder", "CashOnDelivery", "PrivateMediaObject", "StoreEarning", "DriverProfile", "LedgerAccount", "CatalogProduct", "CatalogProductVariant", "CatalogCategory", "CatalogMediaAsset", "StorefrontProductDocument"]) {
      const rows = await tx.$queryRawUnsafe<Record<string, unknown>[]>('SELECT count(*)::int AS count,encode(sha256(convert_to(COALESCE(string_agg(to_jsonb(t)::text,chr(10) ORDER BY to_jsonb(t)::text),\'\'),\'UTF8\')),\'hex\') AS hash FROM "' + name + '" t');
      protectedRows[name] = rows[0];
    }
    report.protected = protectedRows;
    report.policies = await tx.legalDocumentVersion.findMany({ select: { documentType: true, version: true, publicationStatus: true, contentHash: true, effectiveAt: true } });
    report.company = await tx.companyProfileVersion.findMany({ select: { versionNumber: true, status: true, registrationNumber: true, vatNumber: true } });
    report.parcels = await tx.parcelProfileVersion.findMany({ select: { stableKey: true, versionNumber: true, status: true } });
    report.services = await tx.deliveryServiceDefinition.findMany({ select: { stableKey: true, versionNumber: true, status: true, pricingPolicy: true } });
    report.processorRuns = await tx.operationalProcessorRun.findMany({ select: { jobName: true, status: true, itemsCompleted: true, itemsRetried: true, startedAt: true }, orderBy: { startedAt: "desc" }, take: 12 });
    const counts: Record<string, number> = {};
    for (const name of ["CommissionPlan", "PaymentMethodPolicy", "StoreOrderOperationalPolicy", "SubscriptionPlanVersion", "NotificationEventRouteVersion", "NotificationTemplateVersion"]) {
      const rows = await tx.$queryRawUnsafe<{ count: number }[]>('SELECT count(*)::int AS count FROM "' + name + '"');
      counts[name] = rows[0].count;
    }
    report.pendingConfigurationCounts = counts;
    report.customerNotificationConfiguration = {
      templates: await tx.notificationTemplateVersion.findMany({ select: { status: true, versionNumber: true } }),
      recipientPolicies: await tx.notificationRecipientPolicyVersion.findMany({ select: { key: true, status: true, versionNumber: true } }),
      routes: await tx.notificationEventRouteVersion.findMany({ select: { status: true, versionNumber: true, activatedAt: true } }),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 60_000 });
  return report;
}
// Importing the audit for disposable proof does not execute an audit or disconnect.
if (/(?:^|[\\/])audit-reviewed-production\.ts$/.test(process.argv[1] ?? "")) {
  reviewedProtectedRowAudit().then(report => console.log(JSON.stringify(report))).catch(() => { console.error("Read-only production evidence failed."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
}
