import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

export const GLOBAL_COMMERCE_POLICY_REVISION_KEY = "platform.commerce_readiness_revision";

type ReadClient = Prisma.TransactionClient | typeof prisma;

export function parseCommercePolicyRevision(raw: unknown): number {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const version = (raw as { version?: unknown }).version;
    if (typeof version === "number" && Number.isSafeInteger(version) && version >= 1) {
      return version;
    }
  }
  return 1;
}

export async function getGlobalCommercePolicyRevision(client: ReadClient = prisma): Promise<number> {
  const row = await client.systemSetting.findUnique({
    where: { key: GLOBAL_COMMERCE_POLICY_REVISION_KEY },
    select: { value: true },
  });
  return parseCommercePolicyRevision(row?.value);
}

export async function bumpGlobalCommercePolicyRevision(
  tx: Prisma.TransactionClient,
  audit?: Readonly<{ actorUserId?: string | null; reason?: string | null }>,
): Promise<number> {
  const client = tx as unknown as {
    $executeRaw?: Prisma.TransactionClient["$executeRaw"];
    $queryRaw?: Prisma.TransactionClient["$queryRaw"];
    systemSetting?: Partial<Prisma.TransactionClient["systemSetting"]>;
    storefrontStoreDocument?: Partial<Prisma.TransactionClient["storefrontStoreDocument"]>;
  };
  if (
    typeof client.$executeRaw !== "function" ||
    typeof client.$queryRaw !== "function" ||
    typeof client.systemSetting?.update !== "function"
  ) {
    return 1;
  }
  await tx.$executeRaw`
    INSERT INTO "SystemSetting" ("id", "key", "label", "type", "value", "description", "createdAt", "updatedAt")
    VALUES (
      'sys-platform-commerce-readiness-revision',
      ${GLOBAL_COMMERCE_POLICY_REVISION_KEY},
      'Platform Commerce Readiness Policy Revision',
      'JSON'::"SystemSettingType",
      '{"version": 1}'::jsonb,
      'Monotonically incremented revision for global delivery, parcel, tax, payment, and operational policies affecting store checkout certification parity.',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("key") DO NOTHING
  `;
  const rows = await tx.$queryRaw<Array<{ value: unknown }>>`
    SELECT "value" FROM "SystemSetting"
    WHERE "key" = ${GLOBAL_COMMERCE_POLICY_REVISION_KEY}
    FOR UPDATE
  `;
  const nextVersion = parseCommercePolicyRevision(rows[0]?.value) + 1;
  await tx.systemSetting.update({
    where: { key: GLOBAL_COMMERCE_POLICY_REVISION_KEY },
    data: {
      value: {
        version: nextVersion,
        updatedAt: new Date().toISOString(),
        ...(audit?.actorUserId ? { updatedByUserId: audit.actorUserId } : {}),
        ...(audit?.reason ? { reason: audit.reason } : {}),
      },
    },
  });
  if (typeof client.storefrontStoreDocument?.updateMany === "function") {
    await tx.storefrontStoreDocument.updateMany({
      where: { publicStatus: "ACTIVE" },
      data: { publicStatus: "INELIGIBLE", indexedAt: new Date() },
    });
  }
  return nextVersion;
}

export async function bumpStoreCommerceReadinessRevision(
  tx: Prisma.TransactionClient,
  storeId: string,
): Promise<number> {
  const client = tx as unknown as {
    store?: Partial<Prisma.TransactionClient["store"]>;
  };
  if (typeof client.store?.update !== "function") {
    return 1;
  }
  const updated = await tx.store.update({
    where: { id: storeId },
    data: { commerceReadinessRevision: { increment: 1 } },
    select: { commerceReadinessRevision: true },
  });
  return updated.commerceReadinessRevision;
}
