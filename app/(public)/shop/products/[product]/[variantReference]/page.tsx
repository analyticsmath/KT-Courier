import type { Metadata } from "next";
import { ProductDetailExperience } from "@/components/public-v2/commerce";
import styles from "@/components/public-v2/commerce/commerce.module.css";
import {
  marketplacePublicReference,
  marketplaceVariantHref,
  parseMarketplaceProductParameter,
} from "@/lib/public-marketplace/routes";
import { storefrontVariantJsonLd } from "@/lib/storefront/seo/storefront-structured-data";
import { publicStorefrontPageExposureAllowed } from "@/lib/storefront/storefront-page-access";
import {
  getStorefrontProduct,
  getStorefrontStore,
  getStorefrontVariant,
} from "@/lib/services/storefront-catalog.service";
import { PostgresStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ product: string; variantReference: string }>;
}): Promise<Metadata> {
  if (!publicStorefrontPageExposureAllowed()) return { robots: { index: false, follow: true } };
  const { product, variantReference } = await params;
  const parsed = parseMarketplaceProductParameter(product);
  if (!parsed || !marketplacePublicReference(variantReference)) return {};
  const data = await getStorefrontVariant(parsed.reference, variantReference);
  const canonical = data
    ? marketplaceVariantHref(data.variant.productSlug, data.variant.productReference, data.variant.variantReference)
    : null;
  return data && data.variant.productSlug === parsed.slug
    ? {
        title: `${data.variant.title} | ${data.variant.variantReference}`,
        alternates: canonical ? { canonical } : undefined,
      }
    : {};
}

export default async function VariantPage({
  params,
}: {
  params: Promise<{ product: string; variantReference: string }>;
}) {
  const { product, variantReference } = await params;
  const parsed = parseMarketplaceProductParameter(product);
  if (!parsed || !marketplacePublicReference(variantReference)) notFound();
  const [data, productData] = await Promise.all([
    getStorefrontVariant(parsed.reference, variantReference),
    getStorefrontProduct(parsed.reference),
  ]);
  if (!data || data.variant.productSlug !== parsed.slug || !productData) notFound();
  const { variant, offers } = data;

  const [sameStore, related, store] = await Promise.all([
    new StorefrontSearchService(new PostgresStorefrontSearchAdapter()).search({
      store: productData.product.storeSlug,
      pageSize: 8,
    }),
    new StorefrontSearchService(new PostgresStorefrontSearchAdapter()).search({
      category: productData.product.categoryPath,
      pageSize: 8,
    }),
    getStorefrontStore(productData.product.storeSlug),
  ]);

  const sameStoreProducts = sameStore.results
    .filter((item) => item.productReference !== productData.product.productReference)
    .slice(0, 4);
  const relatedProducts = related.results
    .filter((item) => item.productReference !== productData.product.productReference)
    .slice(0, 4);

  // Variant document adapted to product structure for visual continuity
  const variantAsProduct = {
    ...productData.product,
    title: variant.title,
    primaryMedia: variant.primaryMedia || productData.product.primaryMedia,
    price: variant.price,
    availability: variant.availability,
  };

  return (
    <main className={styles.commerceRoot} id="storefront-content">
      <script
        dangerouslySetInnerHTML={{
          __html: storefrontVariantJsonLd(variant),
        }}
        type="application/ld+json"
      />
      <ProductDetailExperience
        modifierGroupsByOffer={productData.modifierGroupsByOffer}
        offers={offers}
        product={variantAsProduct}
        relatedProducts={relatedProducts}
        sameStoreProducts={sameStoreProducts}
        selectedVariantReference={variant.variantReference}
        store={store}
      />
    </main>
  );
}
