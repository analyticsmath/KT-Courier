import { homepageMedia, type HomepageMediaAsset } from "./homepage-media";

export type R9EntryMediaId =
  | "marketplace-storefront"
  | "marketplace-fulfilment"
  | "marketplace-preparation"
  | "participation-store"
  | "participation-driver"
  | "participation-promoter";

export type R9EntryMediaAsset = Pick<
  HomepageMediaAsset,
  | "src"
  | "width"
  | "height"
  | "format"
  | "alt"
  | "decorative"
  | "focalPoint"
  | "provisional"
  | "sourceLedgerReference"
  | "status"
  | "replacementPriority"
> & {
  id: R9EntryMediaId;
  pageUsages: readonly string[];
  editorialOnly: true;
  visibleBrandReview: string;
};

function fromCampaignMedia(
  id: R9EntryMediaId,
  source: HomepageMediaAsset,
  pageUsages: readonly string[],
  visibleBrandReview: string,
): R9EntryMediaAsset {
  return {
    id,
    src: source.src,
    width: source.width,
    height: source.height,
    format: source.format,
    alt: source.alt,
    decorative: source.decorative,
    focalPoint: source.focalPoint,
    provisional: source.provisional,
    sourceLedgerReference: source.sourceLedgerReference,
    status: source.status,
    replacementPriority: source.replacementPriority,
    pageUsages,
    editorialOnly: true,
    visibleBrandReview,
  };
}

/**
 * Reuses reviewed local R2 campaign photography. These records are editorial
 * context only and are never catalog, store, product, or programme evidence.
 */
export const r9EntryMedia = {
  "marketplace-storefront": fromCampaignMedia(
    "marketplace-storefront",
    homepageMedia.marketplace.storefront,
    ["/shop"],
    "Independent-store context only; it does not represent a published store or catalog listing.",
  ),
  "marketplace-fulfilment": fromCampaignMedia(
    "marketplace-fulfilment",
    homepageMedia.marketplace.fulfilment,
    ["/shop"],
    "Order-preparation context only; it does not represent stock, a price, or a live fulfilment promise.",
  ),
  "marketplace-preparation": fromCampaignMedia(
    "marketplace-preparation",
    homepageMedia.documentary[0],
    ["/shop"],
    "Preparation context only; it is not a product or category listing.",
  ),
  "participation-store": fromCampaignMedia(
    "participation-store",
    homepageMedia.network.store,
    ["/join"],
    "Store-operation context only; it does not establish marketplace exposure or a named merchant relationship.",
  ),
  "participation-driver": fromCampaignMedia(
    "participation-driver",
    homepageMedia.network.driver,
    ["/join"],
    "Driver-network context only; it does not depict a current opening or state participation requirements.",
  ),
  "participation-promoter": fromCampaignMedia(
    "participation-promoter",
    homepageMedia.documentary[5],
    ["/join"],
    "Community handoff context only; it does not depict a promoter, referral, or programme benefit.",
  ),
} as const satisfies Record<R9EntryMediaId, R9EntryMediaAsset>;

export const allR9EntryMedia = Object.values(r9EntryMedia);

export function getR9EntryMedia(id: R9EntryMediaId): R9EntryMediaAsset {
  return r9EntryMedia[id];
}
