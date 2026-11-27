import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductDetailExperience } from "@/components/public-v2/commerce";
import styles from "@/components/public-v2/commerce/commerce.module.css";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCommerceCategoryHierarchy } from "@/lib/public-marketplace/category-presentation";
import { parseMarketplaceProductParameter } from "@/lib/public-marketplace/routes";
import { resolveQaAcceptanceSessionContext, resolveQaVisibleStoreIdsForViewer } from "@/lib/qa-acceptance/access";
import { getQaStorefrontProduct, getQaStorefrontStore } from "@/lib/services/storefront-catalog.service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Private QA Product | KT Couriers",
  robots: { index: false, follow: false },
};

export default async function QaPrivateProductDetailPage({
  params,
}: {
  params: Promise<{ product: string }>;
}) {
  const user = await getCurrentUser().catch(() => null);
  const qaCtx = user ? await resolveQaAcceptanceSessionContext(user.id).catch(() => null) : null;
  if (!qaCtx) notFound();

  const parsed = parseMarketplaceProductParameter((await params).product);
  if (!parsed) notFound();
  const visibleStoreIds = await resolveQaVisibleStoreIdsForViewer(user!.id).catch(() => []);
  const data = await getQaStorefrontProduct(parsed.reference, visibleStoreIds);
  if (!data || data.product.productSlug !== parsed.slug) notFound();

  const { product, offers, modifierGroupsByOffer } = data;
  const [store, categoryHierarchy] = await Promise.all([
    getQaStorefrontStore(product.storeSlug, visibleStoreIds),
    getCommerceCategoryHierarchy(product.categoryPath),
  ]);

  return (
    <main className={styles.commerceRoot} id="storefront-content">
      <div
        className="mx-auto mt-4 max-w-5xl rounded-xl border border-[var(--kt-public-border-default)] bg-[var(--kt-public-surface-secondary)] px-4 py-3 text-sm text-[var(--kt-public-text-primary)]"
        role="status"
      >
        <strong>Private QA Product</strong> — Enrolled QA acceptance lane only. Run:{" "}
        <span className="font-mono text-xs">{qaCtx.activeRunReference ?? "enrolled session"}</span>.{" "}
        <Link href="/shop/qa" className="font-semibold underline underline-offset-4">All QA Stores</Link> ·{" "}
        <Link href="/cart" className="font-semibold underline underline-offset-4">View Cart</Link>
      </div>
      <ProductDetailExperience
        categoryHierarchy={categoryHierarchy}
        modifierGroupsByOffer={modifierGroupsByOffer}
        offers={offers}
        product={product}
        qaMode
        store={store ? { slug: store.slug, name: store.name, description: store.description } : null}
      />
    </main>
  );
}
