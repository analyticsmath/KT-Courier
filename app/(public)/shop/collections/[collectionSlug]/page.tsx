import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/public-v2/commerce/commerce.module.css";
import {
  marketplaceCategoryHref,
  marketplaceCollectionHref,
  marketplaceCollectionsHref,
  marketplaceHref,
  marketplaceProductHref,
  marketplaceSlug,
  marketplaceStoreHref,
  marketplaceVariantHref,
} from "@/lib/public-marketplace/routes";
import { getStorefrontCollection } from "@/lib/services/storefront-catalog.service";
import { publicStorefrontPageExposureAllowed } from "@/lib/storefront/storefront-page-access";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ collectionSlug: string }>;
}): Promise<Metadata> {
  if (!publicStorefrontPageExposureAllowed()) return { robots: { index: false, follow: true } };
  const collectionSlug = marketplaceSlug((await params).collectionSlug);
  if (!collectionSlug) return {};
  const collection = await getStorefrontCollection(collectionSlug);
  const canonical = collection ? marketplaceCollectionHref(collection.slug) : null;
  return collection
    ? {
        title: `${collection.name} | Curated Collection`,
        description: collection.description,
        robots: { index: collection.indexable, follow: true },
        alternates: canonical ? { canonical } : undefined,
      }
    : {};
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ collectionSlug: string }>;
}) {
  const collectionSlug = marketplaceSlug((await params).collectionSlug);
  if (!collectionSlug) notFound();
  const collection = await getStorefrontCollection(collectionSlug);
  if (!collection || !collection.items.length) notFound();

  const entries = collection.items.flatMap((item) => {
    if (!item) return [];
    const entry = item.product
      ? {
          href: marketplaceProductHref(item.product.productSlug, item.product.productReference),
          title: item.label ?? item.product.title,
          copy: item.product.shortDescription,
        }
      : item.variant
        ? {
            href: marketplaceVariantHref(
              item.variant.productSlug,
              item.variant.productReference,
              item.variant.variantReference
            ),
            title: item.label ?? item.variant.title,
            copy: item.variant.shortDescription,
          }
        : item.category
          ? {
              href: marketplaceCategoryHref(item.category.path),
              title: item.label ?? item.category.name,
              copy: item.category.description,
            }
          : item.store
            ? {
                href: marketplaceStoreHref(item.store.slug),
                title: item.label ?? item.store.name,
                copy: item.store.description,
              }
            : null;

    return entry?.href
      ? [{ key: `${item.targetType}:${item.targetReference}`, type: item.targetType, ...entry, href: entry.href }]
      : [];
  });

  return (
    <main className={styles.commerceRoot} id="storefront-content">
      <div className={styles.commerceInner}>
        <nav
          aria-label="Breadcrumb"
          style={{
            fontSize: "0.85rem",
            color: "var(--kt-muted, #5f6763)",
            padding: "1.5rem 0 1rem",
          }}
        >
          <Link href={marketplaceHref()} style={{ color: "inherit", textDecoration: "none" }}>
            Shop
          </Link>{" "}
          /{" "}
          <Link href={marketplaceCollectionsHref()} style={{ color: "inherit", textDecoration: "none" }}>
            Collections
          </Link>{" "}
          / <span aria-current="page" style={{ color: "var(--kt-carbon, #101210)", fontWeight: 600 }}>{collection.name}</span>
        </nav>

        <div style={{ marginBottom: "2.5rem" }}>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)", fontWeight: 560, letterSpacing: "-0.035em", margin: "0 0 8px" }}>
            {collection.name}
          </h1>
          {collection.description && (
            <p style={{ color: "var(--kt-muted, #5f6763)", fontSize: "1.05rem", margin: 0, maxWidth: 600 }}>
              {collection.description}
            </p>
          )}
        </div>

        <ul
          aria-label={collection.name}
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 24,
            paddingBottom: "4rem",
          }}
        >
          {entries.map((entry) => (
            <li
              key={entry.key}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "20px 24px",
                backgroundColor: "var(--kt-cool-050, #f5f6f6)",
                border: "1px solid var(--kt-cool-200, #dde1e0)",
              }}
            >
              <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--kt-muted, #5f6763)", marginBottom: 6 }}>
                {entry.type.toLowerCase()}
              </span>
              <Link
                href={entry.href}
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 600,
                  color: "var(--kt-carbon, #101210)",
                  textDecoration: "none",
                  marginBottom: 8,
                }}
              >
                {entry.title}
              </Link>
              {entry.copy && (
                <p style={{ fontSize: "0.9rem", color: "var(--kt-graphite, #303532)", margin: 0, lineHeight: 1.4 }}>
                  {entry.copy}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
