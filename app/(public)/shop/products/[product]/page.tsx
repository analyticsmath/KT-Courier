import type { Metadata } from "next";
import { ProductDetailExperience } from "@/components/public-v2/commerce";
import styles from "@/components/public-v2/commerce/commerce.module.css";
import {
  marketplaceProductHref,
  parseMarketplaceProductParameter,
} from "@/lib/public-marketplace/routes";
import {
  storefrontProductGroupJsonLd,
} from "@/lib/storefront/seo/storefront-structured-data";
import { publicStorefrontPageExposureAllowed } from "@/lib/storefront/storefront-page-access";
import { getStorefrontProduct, getStorefrontStore } from "@/lib/services/storefront-catalog.service";
import { PostgresStorefrontSearchAdapter } from "@/lib/storefront/search/storefront-search-adapter";
import { StorefrontSearchService } from "@/lib/storefront/search/storefront-search.service";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ product: string }>;
}): Promise<Metadata> {
  if (!publicStorefrontPageExposureAllowed()) return { robots: { index: false, follow: true } };
  const parsed = parseMarketplaceProductParameter((await params).product);
  if (!parsed) return {};
  const data = await getStorefrontProduct(parsed.reference);
  if (!data || data.product.productSlug !== parsed.slug) return {};
  const canonical = marketplaceProductHref(data.product.productSlug, data.product.productReference);
  return data
    ? {
        title: `${data.product.title} | KT Couriers Marketplace`,
        description: data.product.shortDescription ?? data.product.description,
        alternates: canonical ? { canonical } : undefined,
        openGraph: {
          title: data.product.title,
          description: data.product.shortDescription ?? data.product.description,
          ...(data.product.primaryMedia
            ? {
                images: [
                  {
                    url: `/api/catalog/media/${data.product.primaryMedia.publicReference}`,
                    width: data.product.primaryMedia.width,
                    height: data.product.primaryMedia.height,
                    alt: data.product.primaryMedia.alt,
                  },
                ],
              }
            : {}),
        },
      }
    : {};
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ product: string }>;
}) {
  const parsed = parseMarketplaceProductParameter((await params).product);
  if (!parsed) notFound();
  const data = await getStorefrontProduct(parsed.reference);
  if (!data || data.product.productSlug !== parsed.slug) notFound();
  const { product, offers } = data;

  const [sameStore, related, store] = await Promise.all([
    new StorefrontSearchService(new PostgresStorefrontSearchAdapter()).search({
      store: product.storeSlug,
      pageSize: 8,
    }),
    new StorefrontSearchService(new PostgresStorefrontSearchAdapter()).search({
      category: product.categoryPath,
      pageSize: 8,
    }),
    getStorefrontStore(product.storeSlug),
  ]);

  const sameStoreProducts = sameStore.results
    .filter((item) => item.productReference !== product.productReference)
    .slice(0, 4);
  const relatedProducts = related.results
    .filter((item) => item.productReference !== product.productReference)
    .slice(0, 4);

  // Purchase controls are unavailable until the canonical cart and checkout flow is enabled.
  return (
    <main className={styles.commerceRoot} id="storefront-content">
      <script
        dangerouslySetInnerHTML={{
          __html: storefrontProductGroupJsonLd(product, offers),
        }}
        type="application/ld+json"
      />
      <ProductDetailExperience
        modifierGroupsByOffer={data.modifierGroupsByOffer}
        offers={offers}
        product={product}
        relatedProducts={relatedProducts}
        sameStoreProducts={sameStoreProducts}
        store={store}
      />
    </main>
  );
}
