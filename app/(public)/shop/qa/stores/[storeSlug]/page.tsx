import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketplaceProductCard } from "@/components/public-v2/commerce/MarketplaceProductCard";
import { StoreHero } from "@/components/public-v2/commerce/StoreHero";
import styles from "@/components/public-v2/commerce/commerce.module.css";
import { getCurrentUser } from "@/lib/auth/current-user";
import { marketplaceSlug } from "@/lib/public-marketplace/routes";
import { resolveQaAcceptanceSessionContext, resolveQaVisibleStoreIdsForViewer } from "@/lib/qa-acceptance/access";
import { getQaStorefrontStore } from "@/lib/services/storefront-catalog.service";
import type { StorefrontProductCard } from "@/lib/storefront/storefront-types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Private QA Store | KT Couriers",
  robots: { index: false, follow: false },
};

export default async function QaPrivateStoreDetailPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const user = await getCurrentUser().catch(() => null);
  const qaCtx = user ? await resolveQaAcceptanceSessionContext(user.id).catch(() => null) : null;
  if (!qaCtx) notFound();

  const storeSlug = marketplaceSlug((await params).storeSlug);
  if (!storeSlug) notFound();
  const visibleStoreIds = await resolveQaVisibleStoreIdsForViewer(user!.id).catch(() => []);
  const store = await getQaStorefrontStore(storeSlug, visibleStoreIds);
  if (!store) notFound();

  const cards: StorefrontProductCard[] = store.products.map((doc) => ({
    productReference: doc.productReference,
    productSlug: doc.productSlug,
    title: doc.title,
    brandName: doc.brandName,
    availability: doc.availability,
    primaryMedia: doc.primaryMedia,
    representativeVariantReference: doc.variantReference,
    variantCount: 1,
    storeCount: 1,
    price: {
      amount: doc.price.amount,
      currency: "ZAR",
      includesTax: doc.price.includesTax,
      from: false,
    },
  }));

  return (
    <main className={styles.commerceRoot} id="storefront-content">
      <div className="mx-auto mt-4 max-w-5xl rounded-xl border border-[var(--kt-public-border-default)] bg-[var(--kt-public-surface-secondary)] px-4 py-3 text-sm text-[var(--kt-public-text-primary)]" role="status">
        <strong>Private QA Acceptance Storefront</strong> — Hidden from public search and ordinary customers. Run:{" "}
        <span className="font-mono text-xs">{qaCtx.activeRunReference ?? "enrolled session"}</span>.{" "}
        <Link href="/cart" className="font-semibold underline underline-offset-4">Go to Cart</Link>
      </div>
      <StoreHero qaMode store={store} />
      <section className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6">
        {store.operatingHoursSummary ? (
          <div className="rounded-lg border border-[var(--kt-public-border-default)] bg-[var(--kt-public-surface-primary)] p-4 text-sm text-[var(--kt-public-text-secondary)]">
            <strong className="text-[var(--kt-public-text-primary)]">Trading &amp; collection hours:</strong> {store.operatingHoursSummary}
          </div>
        ) : null}
        <h2 className="text-xl font-bold text-[var(--kt-public-text-primary)]">Published QA Catalog</h2>
        {cards.length === 0 ? (
          <p className="text-sm text-[var(--kt-public-text-muted)]">No published QA offers are currently active for this store.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <MarketplaceProductCard key={card.productReference} product={card} qaMode variant="grid" />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
