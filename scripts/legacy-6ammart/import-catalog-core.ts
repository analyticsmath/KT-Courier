import { legacyItemTaxonomyNames } from "../../lib/migrations/legacy-6ammart/catalog-taxonomy.mjs";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  Prisma,
  PrismaClient,
  UserRole,
  UserStatus,
} from "@prisma/client";
import { assertLegacyApplyAllowed, assertLegacyTargetOwnership } from "../../lib/migrations/legacy-6ammart/target-policy";
import {
  isLegacyStorePublicationCandidate,
  legacyItemDisposition,
  legacyProductTypeCode,
  legacyReferences,
  legacySlug,
  normalizeLegacyEmail,
  normalizeLegacyPhone,
  parseLegacyVariants,
} from "../../lib/migrations/legacy-6ammart/catalog-policy";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Legacy source tables have different column sets.
type AnyRecord = Record<string, any>;

type SourcePackage = {
  packageVersion: number;
  source: {
    system: string;
    database: string;
    dumpSha256: string;
  };
  tables: {
    vendors: AnyRecord[];
    stores: AnyRecord[];
    store_schedule?: AnyRecord[];
    categories: AnyRecord[];
    brands?: AnyRecord[];
    units?: AnyRecord[];
    items: AnyRecord[];
    add_ons?: AnyRecord[];
  };
  media?: Record<
    string,
    {
      exists?: boolean;
      byteSize?: number;
      zeroByte?: boolean;
      missing?: boolean;
    }
  >;
};

const rootClient = new PrismaClient();
let prisma: Prisma.TransactionClient = rootClient;

function arg(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(label + " is required.");
  }
  return value.trim();
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function intValue(value: unknown, fallback = 0): number {
  return Math.trunc(numberValue(value, fallback));
}

function dateValue(value: unknown): Date {
  const parsed = new Date(typeof value === "string" ? value : "");
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function sourceHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function normalizedName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function discountedPrice(base: number, discount: number, type: unknown): number {
  if (!Number.isFinite(base) || base < 0) return 0;
  if (!Number.isFinite(discount) || discount <= 0) return base;
  if (String(type).toLowerCase() === "percent") {
    return Math.max(0, base * (1 - Math.min(discount, 100) / 100));
  }
  return Math.max(0, base - discount);
}

function categoryPath(
  sourceId: number,
  byId: Map<number, AnyRecord>,
): string[] {
  const result: string[] = [];
  const seen = new Set<number>();
  let current = byId.get(sourceId);
  while (current && !seen.has(intValue(current.id))) {
    const id = intValue(current.id);
    seen.add(id);
    result.unshift(String(current.name ?? "Category").trim());
    const parentId = intValue(current.parent_id, 0);
    current = parentId > 0 ? byId.get(parentId) : undefined;
  }
  return result;
}

function mediaEvidence(pkg: SourcePackage, filename: unknown) {
  const key = typeof filename === "string" ? filename.trim() : "";
  const row = key ? pkg.media?.[key] : undefined;
  return row
    ? {
        exists: row.exists === true && row.missing !== true,
        byteSize: intValue(row.byteSize, 0),
        decodable: row.zeroByte !== true && intValue(row.byteSize, 0) > 0,
      }
    : null;
}

function assertPackage(pkg: SourcePackage): void {
  if (pkg.packageVersion !== 1) {
    throw new Error("Unsupported legacy source package version.");
  }
  if (pkg.source?.system !== "LEGACY_6AMMART") {
    throw new Error("Source package is not a trusted 6amMart migration package.");
  }
  if (pkg.source.database !== "wwwktcouriers_ktcouaielidb") throw new Error("Only the primary legacy business database may be imported.");
  if (!/^[a-f0-9]{64}$/.test(pkg.source.dumpSha256 ?? "")) {
    throw new Error("Source package fingerprint is invalid.");
  }
  for (const key of ["vendors", "stores", "categories", "items"] as const) {
    if (!Array.isArray(pkg.tables?.[key])) {
      throw new Error("Source package is missing table " + key + ".");
    }
  }
}

async function assertTargetAllowed(apply: boolean, pkg: SourcePackage, preserved: Partial<Record<"Store" | "CatalogProduct" | "CatalogMediaAsset", string[]>> = {}): Promise<void> {
  if (!apply) return;
  assertLegacyApplyAllowed();
  const run = await prisma.legacyMigrationRun.findUnique({
    where: { publicReference: legacyReferences.run(pkg.source.dumpSha256) },
  });
  for (const model of ["Store", "CatalogProduct", "CatalogMediaAsset"] as const) {
    const records = model === "Store" ? await prisma.store.findMany({ select: { id: true } })
      : model === "CatalogProduct" ? await prisma.catalogProduct.findMany({ select: { id: true } })
      : await prisma.catalogMediaAsset.findMany({ select: { id: true } });
    const mappings = run ? await prisma.legacyMigrationMap.findMany({
      where: { runId: run.id, targetModel: model }, select: { targetId: true },
    }) : [];
    assertLegacyTargetOwnership(records.map((record) => record.id), mappings.map((mapping) => mapping.targetId), model, preserved[model]);
  }
}

async function mapSource(input: {
  runId: string;
  pkg: SourcePackage;
  table: string;
  sourceId: string | number;
  source: unknown;
  disposition: string;
  targetModel: string;
  targetId: string;
  targetPublicReference?: string | null;
  safeMetadata?: Prisma.InputJsonValue;
}) {
  await prisma.legacyMigrationMap.upsert({
    where: {
      sourceSystem_sourceDatabase_sourceTable_sourceId_targetModel: {
        sourceSystem: input.pkg.source.system,
        sourceDatabase: input.pkg.source.database,
        sourceTable: input.table,
        sourceId: String(input.sourceId),
        targetModel: input.targetModel,
      },
    },
    update: {
      runId: input.runId,
      sourceHash: sourceHash(input.source),
      disposition: input.disposition,
      targetId: input.targetId,
      targetPublicReference: input.targetPublicReference ?? null,
      safeMetadata: input.safeMetadata,
    },
    create: {
      runId: input.runId,
      sourceSystem: input.pkg.source.system,
      sourceDatabase: input.pkg.source.database,
      sourceTable: input.table,
      sourceId: String(input.sourceId),
      sourceHash: sourceHash(input.source),
      disposition: input.disposition,
      targetModel: input.targetModel,
      targetId: input.targetId,
      targetPublicReference: input.targetPublicReference ?? null,
      safeMetadata: input.safeMetadata,
    },
  });
}

const PROTECTED_TABLES = ["User", "Store", "StoreProfile", "Order", "MarketplaceOrder", "MarketplaceStoreOrder", "MarketplaceOrderLine", "MarketplaceCheckout", "MarketplaceCheckoutLineSnapshot", "Payment", "LedgerEntry", "LedgerAccount", "PrivateMediaObject", "DriverProfile", "CatalogMediaAsset", "ProductTypeDefinition"] as const;
type RetainedRow = { id: string; fingerprint: string };
async function captureRetainedRows(db: Prisma.TransactionClient) {
  const rows: Record<string, RetainedRow[]> = {};
  for (const table of PROTECTED_TABLES) {
    rows[table] = await db.$queryRawUnsafe<RetainedRow[]>('SELECT id, md5(row_to_json(t)::text) AS fingerprint FROM "' + table + '" t ORDER BY id');
  }
  return rows;
}
async function assertRetainedRows(db: Prisma.TransactionClient, baseline: Record<string, RetainedRow[]>) {
  for (const table of PROTECTED_TABLES) {
    const current = new Map((await db.$queryRawUnsafe<RetainedRow[]>('SELECT id, md5(row_to_json(t)::text) AS fingerprint FROM "' + table + '" t')).map((row) => [row.id, row.fingerprint]));
    if (baseline[table].some((row) => current.get(row.id) !== row.fingerprint)) throw new Error("Retained production rows changed: " + table);
  }
}

const PRODUCT_TYPES = [
  ["GROCERIES", "Groceries and Fresh Produce"],
  ["FOOD_DINING", "Restaurant and Prepared Meals"],
  ["HEALTH_WELLNESS", "Pharmacy and Health Wellness"],
  ["FASHION_APPAREL", "Fashion and Apparel"],
  ["ELECTRONICS", "Electronics and Tech Accessories"],
  ["HOME_LIVING", "Home and Living Essentials"],
  ["BOOKS_STATIONERY", "Books and Stationery"],
  ["AUTOMOTIVE", "Automotive and Care"],
  ["CAKES_BAKERY", "Cakes and Artisanal Bakery"],
  ["FLOWERS_PLANTS", "Flowers and Floral Arrangements"],
  ["PET_CARE", "Pet Nutrition and Accessories"],
] as const;

async function main() {
  const packagePath = requiredString(arg("--source"), "--source");
  const rehearse = hasFlag("--rehearse");
  const apply = hasFlag("--apply") || rehearse;
  const raw = await readFile(packagePath, "utf8");
  const pkg = JSON.parse(raw) as SourcePackage;
  assertPackage(pkg);
  const baselinePath = arg("--preserve-target");
  const preserved = baselinePath ? JSON.parse(await readFile(baselinePath, "utf8")) as {
    sourceFingerprint: string; projectId: string; environmentId: string;
    inventory: Partial<Record<"Store" | "CatalogProduct" | "CatalogMediaAsset", string[]>>;
  } : null;
  if (preserved && (preserved.sourceFingerprint !== pkg.source.dumpSha256 ||
    preserved.projectId !== process.env.RAILWAY_PROJECT_ID || preserved.environmentId !== process.env.RAILWAY_ENVIRONMENT_ID)) {
    throw new Error("Preserved target manifest does not match the source and Railway environment.");
  }
  await assertTargetAllowed(apply, pkg, preserved?.inventory);

  const vendorsById = new Map(
    pkg.tables.vendors.map((row) => [intValue(row.id), row]),
  );
  const storesById = new Map(
    pkg.tables.stores.map((row) => [intValue(row.id), row]),
  );
  const categoriesById = new Map(
    pkg.tables.categories.map((row) => [intValue(row.id), row]),
  );
  const brandsById = new Map(
    (pkg.tables.brands ?? []).map((row) => [intValue(row.id), row]),
  );
  const addOnsById = new Map(
    (pkg.tables.add_ons ?? []).map((row) => [intValue(row.id), row]),
  );

  const decisions = pkg.tables.items.map((item) => {
    const storeId = intValue(item.store_id);
    const store = storesById.get(storeId) ?? null;
    const path = categoryPath(intValue(item.category_id), categoriesById);
    const disposition = legacyItemDisposition({
      item: {
        id: intValue(item.id),
        storeId,
        moduleId: intValue(item.module_id),
        status: intValue(item.status),
        isApproved: intValue(item.is_approved),
        categoryPath: path,
      },
      store: store
        ? {
            id: intValue(store.id),
            name: String(store.name ?? ""),
            status: intValue(store.status),
            active: intValue(store.active),
            moduleId: intValue(store.module_id),
          }
        : null,
      primaryMedia: mediaEvidence(pkg, item.image),
    });
    return { item, store, path, disposition };
  });

  const summary = {
    sourceFingerprint: pkg.source.dumpSha256,
    stores: {
      total: pkg.tables.stores.length,
      publish: pkg.tables.stores.filter((store) =>
        isLegacyStorePublicationCandidate({
          id: intValue(store.id),
          name: String(store.name ?? ""),
          status: intValue(store.status),
          active: intValue(store.active),
          moduleId: intValue(store.module_id),
        }),
      ).length,
    },
    products: {
      total: decisions.length,
      publish: decisions.filter((row) => row.disposition === "PUBLISH").length,
      pending: decisions.filter(
        (row) => row.disposition === "PRESERVE_PENDING",
      ).length,
      orphan: decisions.filter(
        (row) => row.disposition === "REJECT_ORPHAN",
      ).length,
    },
  };

  if (!apply) {
    console.log(JSON.stringify({ mode: "dry-run", ...summary }, null, 2));
    return;
  }

  const rollback = new Error("LEGACY_REHEARSAL_ROLLBACK");
  let runReference = legacyReferences.run(pkg.source.dumpSha256);
  try {
    await rootClient.$transaction(async (tx) => {
      prisma = tx;
      await prisma.$queryRaw`SELECT pg_advisory_xact_lock(6142026)`;
      await assertTargetAllowed(true, pkg, preserved?.inventory);
      const protectedRows = preserved ? await captureRetainedRows(prisma) : null;
  // Reconcile identities before the first target write, including phone-only matches.
  for (const sourceStore of pkg.tables.stores) {
    if (!sourceStore.name || /(^|\b)(test|demo|sample|do not use)(\b|$)/i.test(sourceStore.name)) continue;
    const vendorId = intValue(sourceStore.vendor_id);
    const vendor = vendorsById.get(vendorId);
    if (!vendor) throw new Error("Missing legacy vendor " + vendorId);
    const email = normalizeLegacyEmail(vendor.email) ?? normalizeLegacyEmail(sourceStore.email) ?? "legacy.store." + intValue(sourceStore.id) + "@migration.invalid";
    const phone = normalizeLegacyPhone(vendor.phone) ?? normalizeLegacyPhone(sourceStore.phone);
    const storeCollision = await prisma.store.findUnique({ where: { slug: legacySlug(String(sourceStore.name), intValue(sourceStore.id)) }, select: { id: true } });
    if (storeCollision) {
      const ownStore = await prisma.legacyMigrationMap.findFirst({ where: { sourceSystem: pkg.source.system, sourceDatabase: pkg.source.database, sourceTable: "stores", sourceId: String(sourceStore.id), targetModel: "Store", targetId: storeCollision.id } });
      if (!ownStore) throw new Error("Unreconciled store slug collision for legacy store " + sourceStore.id);
    }
    const mapping = await prisma.legacyMigrationMap.findUnique({
      where: { sourceSystem_sourceDatabase_sourceTable_sourceId_targetModel: {
        sourceSystem: pkg.source.system, sourceDatabase: pkg.source.database,
        sourceTable: "vendors", sourceId: String(vendorId), targetModel: "User",
      } },
    });
    const matches = await prisma.user.findMany({
      where: { OR: [{ email }, ...(phone ? [{ phone }] : [])] }, select: { id: true },
    });
    if (matches.some((user) => user.id !== mapping?.targetId)) {
      throw new Error("Unreconciled identity collision for legacy vendor " + vendorId);
    }
  }

  const completedRun = await prisma.legacyMigrationRun.findUnique({
    where: { publicReference: legacyReferences.run(pkg.source.dumpSha256) },
  });
  if (completedRun?.status === "APPLIED") {
    console.log(JSON.stringify({ mode: "already-applied", runReference: completedRun.publicReference, summary: completedRun.summary }));
    return;
  }
  // A disabled audit actor creates no login, demo settings, pricing or ledger state.
  const actor = await prisma.user.upsert({
    where: { email: "legacy-migration@ktcouriers.invalid" },
    update: {},
    create: { email: "legacy-migration@ktcouriers.invalid", name: "Legacy migration audit actor", role: "SUPER_ADMIN", status: "DISABLED", passwordHash: null },
  });
  const bootstrap = { superAdminId: actor.id };

  runReference = legacyReferences.run(pkg.source.dumpSha256);
  const run = await prisma.legacyMigrationRun.upsert({
    where: { publicReference: runReference },
    update: {
      status: "APPLYING",
      startedAt: new Date(),
      completedAt: null,
      summary,
      createdByUserId: bootstrap.superAdminId,
    },
    create: {
      publicReference: runReference,
      sourceSystem: pkg.source.system,
      sourceDatabase: pkg.source.database,
      sourceFingerprint: pkg.source.dumpSha256,
      phase: "CATALOG_CORE",
      status: "APPLYING",
      summary,
      startedAt: new Date(),
      createdByUserId: bootstrap.superAdminId,
    },
  });

      const productTypes = new Map<string, { id: string; versionNumber: number }>();
      for (const [code, name] of PRODUCT_TYPES) {
        const record = await prisma.productTypeDefinition.upsert({
          where: { code_versionNumber: { code, versionNumber: 1 } },
          update: {},
          create: {
            publicReference: "PTD-" + code,
            code,
            name,
            versionNumber: 1,
            status: "ACTIVE",
            attributeSchema: {},
            variantSchema: {},
            complianceSchema: {},
            searchFacetSchema: { facets: [{ code: "brand", public: true }] },
            createdByUserId: bootstrap.superAdminId,
          },
        });
        productTypes.set(code, {
          id: record.id,
          versionNumber: record.versionNumber,
        });
      }

      const storeMap = new Map<number, { id: string; ownerUserId: string }>();
      for (const sourceStore of pkg.tables.stores) {
        const sourceId = intValue(sourceStore.id);
        const name = String(sourceStore.name ?? "").trim();
        if (!name || /(^|\b)(test|demo|sample|do not use)(\b|$)/i.test(name)) {
          continue;
        }

        const vendor = vendorsById.get(intValue(sourceStore.vendor_id));
        const email =
          normalizeLegacyEmail(vendor?.email) ??
          normalizeLegacyEmail(sourceStore.email) ??
          "legacy.store." + sourceId + "@migration.invalid";
        const phone =
          normalizeLegacyPhone(vendor?.phone) ??
          normalizeLegacyPhone(sourceStore.phone);
        const publishStore = isLegacyStorePublicationCandidate({
          id: sourceId,
          name,
          status: intValue(sourceStore.status),
          active: intValue(sourceStore.active),
          moduleId: intValue(sourceStore.module_id),
        });
        const ownerName =
          [vendor?.f_name, vendor?.l_name]
            .filter((value) => typeof value === "string" && value.trim())
            .join(" ")
            .trim() || name;

        const ownerMapping = await prisma.legacyMigrationMap.findUnique({
          where: { sourceSystem_sourceDatabase_sourceTable_sourceId_targetModel: {
            sourceSystem: pkg.source.system, sourceDatabase: pkg.source.database,
            sourceTable: "vendors", sourceId: String(intValue(sourceStore.vendor_id)), targetModel: "User",
          } },
        });
        const existingOwner = await prisma.user.findUnique({ where: { email } });
        if (existingOwner && existingOwner.id !== ownerMapping?.targetId) {
          throw new Error("Unreconciled identity collision for legacy vendor " + intValue(sourceStore.vendor_id));
        }
        const owner = ownerMapping
          ? await prisma.user.findUniqueOrThrow({ where: { id: ownerMapping.targetId } })
          : await prisma.user.create({ data: {
            email, passwordHash: null, name: ownerName, phone,
            role: UserRole.STORE, status: UserStatus.PENDING_VERIFICATION,
            createdAt: dateValue(sourceStore.created_at),
          } });

        await prisma.storeProfile.upsert({
          where: { userId: owner.id },
          update: {
            storeName: name,
            contactPerson: ownerName,
            businessPhone: normalizeLegacyPhone(sourceStore.phone),
            businessEmail: normalizeLegacyEmail(sourceStore.email),
            status: publishStore ? "ACTIVE" : "PENDING",
          },
          create: {
            userId: owner.id,
            storeName: name,
            contactPerson: ownerName,
            businessPhone: normalizeLegacyPhone(sourceStore.phone),
            businessEmail: normalizeLegacyEmail(sourceStore.email),
            status: publishStore ? "ACTIVE" : "PENDING",
          },
        });

        const store = await prisma.store.upsert({
          where: { slug: legacySlug(name, sourceId) },
          update: {
            ownerUserId: owner.id,
            name,
            status: publishStore ? "ACTIVE" : "PENDING",
            contactName: ownerName,
            contactEmail: normalizeLegacyEmail(sourceStore.email),
            contactPhone: normalizeLegacyPhone(sourceStore.phone),
            addressLine1:
              typeof sourceStore.address === "string"
                ? sourceStore.address.trim() || null
                : null,
            featured: intValue(sourceStore.featured) === 1,
          },
          create: {
            ownerUserId: owner.id,
            name,
            slug: legacySlug(name, sourceId),
            status: publishStore ? "ACTIVE" : "PENDING",
            contactName: ownerName,
            contactEmail: normalizeLegacyEmail(sourceStore.email),
            contactPhone: normalizeLegacyPhone(sourceStore.phone),
            addressLine1:
              typeof sourceStore.address === "string"
                ? sourceStore.address.trim() || null
                : null,
            country: "South Africa",
            featured: intValue(sourceStore.featured) === 1,
            createdAt: dateValue(sourceStore.created_at),
          },
        });

        await prisma.inventoryLocation.upsert({
          where: { storeId_name: { storeId: store.id, name: "Legacy Main Store" } },
          update: { isPrimary: true, status: "ACTIVE" },
          create: {
            publicReference: "LEG6-LOC-" + sourceId,
            storeId: store.id,
            name: "Legacy Main Store",
            locationReference: "legacy-6ammart:" + sourceId,
            status: "ACTIVE",
            isPrimary: true,
          },
        });

        storeMap.set(sourceId, { id: store.id, ownerUserId: owner.id });
        await mapSource({
          runId: run.id,
          pkg,
          table: "stores",
          sourceId,
          source: sourceStore,
          disposition: publishStore ? "PUBLISH" : "PRESERVE_PENDING",
          targetModel: "Store",
          targetId: store.id,
          targetPublicReference: store.slug,
        });
        await mapSource({
          runId: run.id,
          pkg,
          table: "vendors",
          sourceId: intValue(sourceStore.vendor_id),
          source: vendor ?? { id: sourceStore.vendor_id },
          disposition: publishStore ? "PUBLISH" : "PRESERVE_PENDING",
          targetModel: "User",
          targetId: owner.id,
          safeMetadata: { role: "STORE" },
        });
      }

      const neededCategoryIds = new Set<number>();
      for (const decision of decisions) {
        if (decision.disposition === "REJECT_ORPHAN") continue;
        let current = categoriesById.get(intValue(decision.item.category_id));
        const seen = new Set<number>();
        while (current) {
          const id = intValue(current.id);
          if (!id || seen.has(id)) break;
          seen.add(id);
          neededCategoryIds.add(id);
          const parentId = intValue(current.parent_id, 0);
          current = parentId > 0 ? categoriesById.get(parentId) : undefined;
        }
      }

      const categoryMap = new Map<number, string>();
      const orderedCategories = [...neededCategoryIds]
        .map((id) => categoriesById.get(id))
        .filter(Boolean)
        .sort((a, b) => categoryPath(intValue(a!.id), categoriesById).length - categoryPath(intValue(b!.id), categoriesById).length) as AnyRecord[];

      for (const sourceCategory of orderedCategories) {
        const sourceId = intValue(sourceCategory.id);
        const parentSourceId = intValue(sourceCategory.parent_id, 0);
        const parentId = parentSourceId > 0 ? categoryMap.get(parentSourceId) ?? null : null;
        const pathParts = categoryPath(sourceId, categoriesById);
        const name = String(sourceCategory.name ?? "Category").trim();
        const slug = legacySlug(name, sourceId);
        const path = pathParts
          .map((part, index) => legacySlug(part, index === pathParts.length - 1 ? sourceId : parentSourceId || index + 1))
          .join("/");

        const category = await prisma.catalogCategory.upsert({
          where: { publicReference: legacyReferences.category(sourceId) },
          update: {
            name,
            slug,
            parentId,
            depth: Math.max(0, pathParts.length - 1),
            path,
            status: "ACTIVE",
            displayOrder: intValue(sourceCategory.position, 0),
            updatedByUserId: bootstrap.superAdminId,
          },
          create: {
            publicReference: legacyReferences.category(sourceId),
            name,
            slug,
            parentId,
            depth: Math.max(0, pathParts.length - 1),
            path,
            status: "ACTIVE",
            displayOrder: intValue(sourceCategory.position, 0),
            createdByUserId: bootstrap.superAdminId,
            updatedByUserId: bootstrap.superAdminId,
            createdAt: dateValue(sourceCategory.created_at),
          },
        });
        categoryMap.set(sourceId, category.id);

        const typeCode = legacyProductTypeCode(
          intValue(sourceCategory.module_id),
          pathParts,
        );
        const type = productTypes.get(typeCode);
        if (type) {
          await prisma.catalogCategoryProductType.upsert({
            where: {
              categoryId_productTypeDefinitionId: {
                categoryId: category.id,
                productTypeDefinitionId: type.id,
              },
            },
            update: { isPrimary: true },
            create: {
              categoryId: category.id,
              productTypeDefinitionId: type.id,
              isPrimary: true,
            },
          });
        }

        await mapSource({
          runId: run.id,
          pkg,
          table: "categories",
          sourceId,
          source: sourceCategory,
          disposition: "IMPORTED",
          targetModel: "CatalogCategory",
          targetId: category.id,
          targetPublicReference: category.publicReference,
        });
      }

      const usedBrandIds = new Set(
        decisions
          .filter((decision) => decision.disposition !== "REJECT_ORPHAN")
          .map((decision) => intValue(decision.item.brand_id))
          .filter((id) => id > 0),
      );
      const brandMap = new Map<number, string>();
      for (const sourceId of usedBrandIds) {
        const sourceBrand = brandsById.get(sourceId);
        if (!sourceBrand) continue;
        const name = String(sourceBrand.name ?? "").trim();
        if (!name) continue;
        const brand = await prisma.catalogBrand.upsert({
          where: { publicReference: legacyReferences.brand(sourceId) },
          update: {
            name,
            normalizedName: normalizedName(name),
            slug: legacySlug(name, sourceId),
            status: "ACTIVE",
            approvedByUserId: bootstrap.superAdminId,
          },
          create: {
            publicReference: legacyReferences.brand(sourceId),
            name,
            normalizedName: normalizedName(name),
            slug: legacySlug(name, sourceId),
            status: "ACTIVE",
            createdByUserId: bootstrap.superAdminId,
            approvedByUserId: bootstrap.superAdminId,
            createdAt: dateValue(sourceBrand.created_at),
          },
        });
        brandMap.set(sourceId, brand.id);
        await mapSource({
          runId: run.id,
          pkg,
          table: "brands",
          sourceId,
          source: sourceBrand,
          disposition: "IMPORTED",
          targetModel: "CatalogBrand",
          targetId: brand.id,
          targetPublicReference: brand.publicReference,
        });
      }

      for (const decision of decisions) {
        if (decision.disposition === "REJECT_ORPHAN") continue;
        const sourceItem = decision.item;
        const sourceId = intValue(sourceItem.id);
        const sourceStoreId = intValue(sourceItem.store_id);
        const targetStore = storeMap.get(sourceStoreId);
        const categoryId = categoryMap.get(intValue(sourceItem.category_id));
        if (!targetStore || !categoryId) continue;

        const typeCode = legacyProductTypeCode(
          intValue(sourceItem.module_id),
          legacyItemTaxonomyNames(sourceItem, categoriesById),
        );
        const productType = productTypes.get(typeCode);
        if (!productType) {
          throw new Error("Missing product type " + typeCode + ".");
        }

        const title = String(sourceItem.name ?? "Legacy Product").trim();
        const publishable = decision.disposition === "PUBLISH";
        const product = await prisma.catalogProduct.upsert({
          where: { publicReference: legacyReferences.product(sourceId) },
          update: {
            sourceStoreId: targetStore.id,
            productTypeDefinitionId: productType.id,
            productTypeVersionNumber: productType.versionNumber,
            primaryCategoryId: categoryId,
            brandId: brandMap.get(intValue(sourceItem.brand_id)) ?? null,
            title,
            normalizedTitle: normalizedName(title),
            description:
              typeof sourceItem.description === "string"
                ? sourceItem.description
                : null,
            status: publishable ? "ACTIVE" : "DRAFT",
            moderationStatus: publishable ? "APPROVED" : "NOT_SUBMITTED",
            publicationStatus: "DRAFT",
            approvedByUserId: publishable ? bootstrap.superAdminId : null,
            qualityIssues: publishable ? [] : ["LEGACY_REVIEW_REQUIRED"],
          },
          create: {
            publicReference: legacyReferences.product(sourceId),
            scope: "STORE_PRIVATE",
            sourceStoreId: targetStore.id,
            productTypeDefinitionId: productType.id,
            productTypeVersionNumber: productType.versionNumber,
            primaryCategoryId: categoryId,
            brandId: brandMap.get(intValue(sourceItem.brand_id)) ?? null,
            title,
            normalizedTitle: normalizedName(title),
            description:
              typeof sourceItem.description === "string"
                ? sourceItem.description
                : null,
            condition: "NEW",
            attributeValues: {
              legacyModuleId: intValue(sourceItem.module_id),
              legacyCategoryIds: sourceItem.category_ids ?? [],
              legacyHalal: intValue(sourceItem.is_halal) === 1,
            },
            complianceValues: {},
            status: publishable ? "ACTIVE" : "DRAFT",
            moderationStatus: publishable ? "APPROVED" : "NOT_SUBMITTED",
            publicationStatus: "DRAFT",
            slug: legacySlug(title, sourceId),
            qualityScore: publishable ? 80 : 40,
            qualityIssues: publishable ? [] : ["LEGACY_REVIEW_REQUIRED"],
            createdByUserId: targetStore.ownerUserId,
            approvedByUserId: publishable ? bootstrap.superAdminId : null,
            createdAt: dateValue(sourceItem.created_at),
          },
        });

        await mapSource({
          runId: run.id,
          pkg,
          table: "items",
          sourceId,
          source: sourceItem,
          disposition: decision.disposition,
          targetModel: "CatalogProduct",
          targetId: product.id,
          targetPublicReference: product.publicReference,
          safeMetadata: {
            primaryMediaFilename:
              typeof sourceItem.image === "string" ? sourceItem.image : null,
          },
        });

        const basePrice = numberValue(sourceItem.price);
        const itemDiscount = numberValue(sourceItem.discount);
        const variants = parseLegacyVariants({
          baseTitle: title,
          basePrice,
          baseStock:
            sourceItem.stock === null || sourceItem.stock === undefined
              ? null
              : intValue(sourceItem.stock),
          variations: sourceItem.variations,
        });

        const inventoryLocation = await prisma.inventoryLocation.findUniqueOrThrow({
          where: {
            storeId_name: {
              storeId: targetStore.id,
              name: "Legacy Main Store",
            },
          },
        });

        for (let index = 0; index < variants.length; index += 1) {
          const sourceVariant = variants[index]!;
          const variant = await prisma.catalogProductVariant.upsert({
            where: { publicReference: legacyReferences.variant(sourceId, index) },
            update: {
              title: sourceVariant.title,
              normalizedTitle: normalizedName(sourceVariant.title),
              optionFingerprint: sourceVariant.optionFingerprint,
              status: publishable ? "ACTIVE" : "DRAFT",
            },
            create: {
              publicReference: legacyReferences.variant(sourceId, index),
              productId: product.id,
              title: sourceVariant.title,
              normalizedTitle: normalizedName(sourceVariant.title),
              skuReference:
                "LEG6-" + sourceStoreId + "-" + sourceId + "-" + (index + 1),
              optionFingerprint: sourceVariant.optionFingerprint,
              attributeValues: sourceVariant.optionLabel
                ? { legacyOption: sourceVariant.optionLabel }
                : {},
              status: publishable ? "ACTIVE" : "DRAFT",
              createdAt: dateValue(sourceItem.created_at),
            },
          });

          const trackingMode =
            intValue(sourceItem.module_id) === 6 ? "UNTRACKED" : "TRACKED";
          const offer = await prisma.storeCatalogOffer.upsert({
            where: { publicReference: legacyReferences.offer(sourceId, index) },
            update: {
              status: publishable ? "ACTIVE" : "DRAFT",
              publicationStatus: "DRAFT",
              primaryInventoryLocationId: inventoryLocation.id,
            },
            create: {
              publicReference: legacyReferences.offer(sourceId, index),
              storeId: targetStore.id,
              productId: product.id,
              variantId: variant.id,
              storeSku:
                "LEG6-" + sourceStoreId + "-" + sourceId + "-" + (index + 1),
              merchantTitle: title,
              merchantDescription:
                typeof sourceItem.description === "string"
                  ? sourceItem.description
                  : null,
              status: publishable ? "ACTIVE" : "DRAFT",
              publicationStatus: "DRAFT",
              inventoryTrackingMode: trackingMode,
              fulfilmentMode: "COURIER_DELIVERY",
              sellingUnit: "EACH",
              primaryInventoryLocationId: inventoryLocation.id,
              createdByUserId: targetStore.ownerUserId,
              approvedByUserId: publishable ? bootstrap.superAdminId : null,
              createdAt: dateValue(sourceItem.created_at),
            },
          });

          const finalPrice = discountedPrice(
            sourceVariant.price,
            itemDiscount,
            sourceItem.discount_type,
          );
          const existingPrice = await prisma.storeOfferPriceVersion.findUnique({
            where: { publicReference: legacyReferences.price(sourceId, index) },
          });
          const price =
            existingPrice ??
            (await prisma.storeOfferPriceVersion.create({
              data: {
                publicReference: legacyReferences.price(sourceId, index),
                offerId: offer.id,
                versionNumber: 1,
                amount: new Prisma.Decimal(finalPrice.toFixed(2)),
                currency: "ZAR",
                priceIncludesTax: true,
                effectiveFrom: dateValue(sourceItem.created_at),
                status: "ACTIVE",
                reasonCode: "LEGACY_6AMMART_CURRENT_PRICE",
                createdByUserId: targetStore.ownerUserId,
                activatedByUserId: bootstrap.superAdminId,
                activatedAt: dateValue(sourceItem.created_at),
                createdAt: dateValue(sourceItem.created_at),
              },
            }));

          await prisma.storeCatalogOffer.update({
            where: { id: offer.id },
            data: { currentPriceVersionId: price.id },
          });

          const inventory = await prisma.catalogInventoryItem.upsert({
            where: { offerId: offer.id },
            update: { trackingMode },
            create: {
              publicReference: legacyReferences.inventory(sourceId, index),
              offerId: offer.id,
              variantId: variant.id,
              trackingMode,
            },
          });

          if (trackingMode === "TRACKED") {
            const quantity = Math.max(0, sourceVariant.stock ?? 0);
            await prisma.catalogInventoryLevel.upsert({
              where: {
                inventoryItemId_locationId: {
                  inventoryItemId: inventory.id,
                  locationId: inventoryLocation.id,
                },
              },
              // A retry must not reset stock or reservations already established.
              update: {},
              create: {
                inventoryItemId: inventory.id,
                locationId: inventoryLocation.id,
                onHand: quantity,
                reserved: 0,
                available: quantity,
              },
            });
          }

          const addOnIds = Array.isArray(sourceItem.add_ons)
            ? sourceItem.add_ons.map((value: unknown) => intValue(value)).filter((id: number) => id > 0)
            : [];
          const availableAddOns = addOnIds
            .map((id: number) => addOnsById.get(id))
            .filter((row): row is AnyRecord => Boolean(row && intValue(row.status) === 1 && intValue(row.store_id) === sourceStoreId));

          if (availableAddOns.length > 0) {
            const group = await prisma.storeModifierGroup.upsert({
              where: {
                storeId_name: { storeId: targetStore.id, name: "Legacy Add-ons " + sourceId },
              },
              update: {
                maximumSelections: availableAddOns.length,
                status: "ACTIVE",
              },
              create: {
                publicReference:
                  "LEG6-MOD-" + sourceId + "-" + (index + 1),
                storeId: targetStore.id,
                name: "Legacy Add-ons " + sourceId,
                description: "Imported optional add-ons",
                minimumSelections: 0,
                maximumSelections: availableAddOns.length,
                isRequired: false,
                status: "ACTIVE",
              },
            });

            for (let optionIndex = 0; optionIndex < availableAddOns.length; optionIndex += 1) {
              const addOn = availableAddOns[optionIndex]!;
              await prisma.storeModifierOption.upsert({
                where: {
                  publicReference:
                    "LEG6-MODOPT-" +
                    sourceId +
                    "-" +
                    (index + 1) +
                    "-" +
                    intValue(addOn.id),
                },
                update: {
                  name: String(addOn.name ?? "Add-on"),
                  priceDelta: new Prisma.Decimal(numberValue(addOn.price).toFixed(2)),
                  status: "ACTIVE",
                },
                create: {
                  publicReference:
                    "LEG6-MODOPT-" +
                    sourceId +
                    "-" +
                    (index + 1) +
                    "-" +
                    intValue(addOn.id),
                  groupId: group.id,
                  name: String(addOn.name ?? "Add-on"),
                  priceDelta: new Prisma.Decimal(numberValue(addOn.price).toFixed(2)),
                  currency: "ZAR",
                  status: "ACTIVE",
                  displayOrder: optionIndex,
                },
              });
            }

            await prisma.storeOfferModifierGroup.upsert({
              where: { offerId_groupId: { offerId: offer.id, groupId: group.id } },
              update: { displayOrder: 0 },
              create: { offerId: offer.id, groupId: group.id, displayOrder: 0 },
            });
          }
        }
      }

      await prisma.legacyMigrationRun.update({
        where: { id: run.id },
        data: {
          status: "VALIDATED",
          summary,
          completedAt: new Date(),
        },
      });

      if (protectedRows) await assertRetainedRows(prisma, protectedRows);
      if (rehearse) throw rollback;
    }, { timeout: 600_000, maxWait: 10_000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    prisma = rootClient;
    console.log(
      JSON.stringify(
        {
          mode: "apply-core",
          runReference,
          ...summary,
          note:
            "Catalogue core imported with publication kept DRAFT until normalized media is synchronized and verified.",
        },
        null,
        2,
      ),
    );
  } catch (error) {
    prisma = rootClient;
    if (error === rollback) {
      console.log(JSON.stringify({ mode: "rehearsed-rolled-back", ...summary, preservedRowsUnchanged: true }));
      return;
    }
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Legacy catalogue import failed.",
    );
    process.exitCode = 1;
  })
  .finally(() => rootClient.$disconnect());
