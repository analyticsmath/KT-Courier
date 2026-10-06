import { legacyProductTypeCode as typeCode, legacyItemTaxonomyNames } from "../../lib/migrations/legacy-6ammart/catalog-taxonomy.mjs";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const value =
      argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    out[key.slice(2)] = value;
  }
  return out;
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function storeIsCandidate(store) {
  return (
    Number(store.status) === 1 &&
    Number(store.active) === 1 &&
    store.name?.trim().length > 1 &&
    !/(^|\b)(test|demo|sample|do not use)(\b|$)/i.test(store.name)
  );
}

const args = parseArgs(process.argv);
if (!args.source || !args.media) {
  console.error(
    "Usage: node plan-catalog.mjs --source source-package.json --media normalized-media-manifest.json [--out plan.json]",
  );
  process.exit(2);
}

const source = JSON.parse(fs.readFileSync(args.source, "utf8"));
const mediaManifest = JSON.parse(fs.readFileSync(args.media, "utf8"));

if (source.source?.system !== "LEGACY_6AMMART") {
  throw new Error("Unexpected source system.");
}
if (
  !source.source?.dumpSha256 ||
  source.source.dumpSha256 !== mediaManifest.sourceDumpSha256
) {
  throw new Error(
    "Source dump fingerprint does not match normalized media manifest.",
  );
}

const tables = source.tables ?? {};
const stores = new Map(
  (tables.stores ?? []).map((row) => [Number(row.id), row]),
);
const categories = new Map(
  (tables.categories ?? []).map((row) => [Number(row.id), row]),
);
const brands = new Map(
  (tables.brands ?? []).map((row) => [Number(row.id), row]),
);
const items = tables.items ?? [];
const mediaAssets = mediaManifest.assets ?? [];

const primaryMediaByItem = new Map(
  mediaAssets
    .filter((asset) => asset.kind === "product" && asset.role === "PRIMARY")
    .map((asset) => [Number(asset.source_id), asset]),
);

const activeStores = [...stores.values()].filter(storeIsCandidate);
const activeStoreIds = new Set(
  activeStores.map((store) => Number(store.id)),
);
const storeMediaKinds = new Map();

for (const asset of mediaAssets.filter(
  (asset) => asset.kind === "store-logo" || asset.kind === "store-hero",
)) {
  const id = Number(asset.source_id);
  if (!storeMediaKinds.has(id)) storeMediaKinds.set(id, new Set());
  storeMediaKinds.get(id).add(asset.kind);
}

const products = [];
const orphan = [];
const pending = [];
const publish = [];
const productTypeCounts = {};
const referencedBrandIds = new Set();
let variantCount = 0;

for (const item of items) {
  const store = stores.get(Number(item.store_id)) ?? null;
  let disposition;

  if (!store) {
    disposition = "REJECT_ORPHAN";
  } else if (
    !activeStoreIds.has(Number(item.store_id)) ||
    Number(item.status) !== 1 ||
    Number(item.is_approved) !== 1
  ) {
    disposition = "PRESERVE_PENDING";
  } else if (!primaryMediaByItem.has(Number(item.id))) {
    disposition = "PRESERVE_PENDING";
  } else {
    disposition = "PUBLISH";
  }

  const variationRows = Array.isArray(item.variations)
    ? item.variations.filter(
        (variation) => variation && typeof variation === "object",
      )
    : [];
  const variants = variationRows.length > 0 ? variationRows.length : 1;
  variantCount += variants;

  const productType = typeCode(item.module_id, legacyItemTaxonomyNames(item, categories));
  productTypeCounts[productType] =
    (productTypeCounts[productType] ?? 0) + 1;

  if (item.brand_id != null && Number(item.brand_id) > 0) {
    referencedBrandIds.add(Number(item.brand_id));
  }

  const row = {
    sourceId: Number(item.id),
    sourceStoreId: Number(item.store_id),
    title: item.name,
    disposition,
    productType,
    variantCount: variants,
    primaryMedia:
      primaryMediaByItem.get(Number(item.id))?.storage_key ?? null,
  };

  products.push(row);
  if (disposition === "PUBLISH") publish.push(row);
  else if (disposition === "REJECT_ORPHAN") orphan.push(row);
  else pending.push(row);
}

const includedCategoryIds = new Set();

for (const product of products.filter(
  (candidate) => candidate.disposition !== "REJECT_ORPHAN",
)) {
  const item = items.find(
    (candidate) => Number(candidate.id) === product.sourceId,
  );

  const seeds = [
    Number(item?.category_id),
    ...(Array.isArray(item?.category_ids)
      ? item.category_ids.map((link) =>
          Number(
            typeof link === "object" && link
              ? (link.id ?? link.category_id)
              : link,
          ),
        )
      : []),
  ].filter(Number.isFinite);

  for (const seed of seeds) {
    let current = categories.get(seed);
    const seen = new Set();

    while (current && !seen.has(Number(current.id))) {
      seen.add(Number(current.id));
      includedCategoryIds.add(Number(current.id));
      current = current.parent_id
        ? categories.get(Number(current.parent_id))
        : null;
    }
  }
}

const plan = {
  version: 1,
  sourceSystem: source.source.system,
  sourceDatabase: source.source.database,
  sourceDumpSha256: source.source.dumpSha256,
  sourcePackageSha256: sha256File(args.source),
  mediaManifestSha256: sha256File(args.media),
  generatedAt: new Date().toISOString(),
  counts: {
    sourceStores: stores.size,
    activeStores: activeStores.length,
    sourceItems: items.length,
    publishProducts: publish.length,
    pendingProducts: pending.length,
    orphanProducts: orphan.length,
    totalPlannedVariants: variantCount,
    includedCategories: includedCategoryIds.size,
    referencedBrands: [...referencedBrandIds].filter((id) =>
      brands.has(id),
    ).length,
    normalizedMediaAssets: mediaAssets.length,
  },
  productTypeCounts,
  stores: activeStores.map((store) => ({
    sourceId: Number(store.id),
    name: store.name,
    moduleId: Number(store.module_id),
    hasLogo:
      storeMediaKinds.get(Number(store.id))?.has("store-logo") ?? false,
    hasHero:
      storeMediaKinds.get(Number(store.id))?.has("store-hero") ?? false,
  })),
  publishProducts: publish,
  pendingProducts: pending,
  orphanProductSourceIds: orphan.map((product) => product.sourceId),
  includedCategorySourceIds: [...includedCategoryIds].sort(
    (a, b) => a - b,
  ),
  referencedBrandSourceIds: [...referencedBrandIds]
    .filter((id) => brands.has(id))
    .sort((a, b) => a - b),
};

const failures = [];
if (stores.size !== 29)
  failures.push(`expected 29 stores, found ${stores.size}`);
if (items.length !== 535)
  failures.push(`expected 535 items, found ${items.length}`);
if (activeStores.length !== 14)
  failures.push(
    `expected 14 publication-candidate stores, found ${activeStores.length}`,
  );
if (publish.length !== 277)
  failures.push(
    `expected 277 media-complete publication candidates, found ${publish.length}`,
  );
if (mediaAssets.length !== 341)
  failures.push(
    `expected 341 normalized publish-media assets, found ${mediaAssets.length}`,
  );

if (failures.length > 0) {
  throw new Error(
    `Legacy migration source drift: ${failures.join("; ")}`,
  );
}

const payload = JSON.stringify(plan, null, 2);
if (args.out) {
  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  fs.writeFileSync(args.out, payload + "\n");
}

console.log(
  JSON.stringify(
    {
      event: "legacy_catalog_plan_ready",
      ...plan.counts,
      productTypeCounts: plan.productTypeCounts,
    },
    null,
    2,
  ),
);
