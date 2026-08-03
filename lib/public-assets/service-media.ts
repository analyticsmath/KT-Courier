import { homepageMedia, type HomepageMediaAsset, type HomepageMediaStatus } from "./homepage-media";

export type ServiceMediaId =
  | "parcel-detail"
  | "parcel-handoff"
  | "food-grocery-preparation"
  | "business-dispatch"
  | "operations-preparation"
  | "freight-movement"
  | "driver-context"
  | "store-preparation"
  | "delivery-status-context"
  | "local-road-context"
  | "delivery-handoff";

export type ServiceMediaAsset = Pick<
  HomepageMediaAsset,
  "src" | "width" | "height" | "format" | "alt" | "decorative" | "focalPoint" | "desktop" | "tablet" | "mobile" | "provisional" | "sourceLedgerReference" | "status"
> & {
  id: ServiceMediaId;
  sourceMediaId: string;
  serviceFamilies: readonly string[];
  pageUsages: readonly string[];
  visibleBrandReview: string;
  replacementPriority: "LOW" | "MEDIUM" | "HIGH";
  provenanceStatus: HomepageMediaStatus;
};

function fromHomepageMedia(
  id: ServiceMediaId,
  source: HomepageMediaAsset,
  serviceFamilies: readonly string[],
  pageUsages: readonly string[],
  visibleBrandReview: string,
): ServiceMediaAsset {
  return {
    id,
    sourceMediaId: source.id,
    src: source.src,
    width: source.width,
    height: source.height,
    format: source.format,
    alt: source.alt,
    decorative: source.decorative,
    focalPoint: source.focalPoint,
    desktop: source.desktop,
    tablet: source.tablet,
    mobile: source.mobile,
    provisional: source.provisional,
    sourceLedgerReference: source.sourceLedgerReference,
    status: source.status,
    provenanceStatus: source.status,
    serviceFamilies,
    pageUsages,
    visibleBrandReview,
    replacementPriority: source.replacementPriority,
  };
}

/**
 * R6 reuses the reviewed R2/R4 local campaign library. No new service media is
 * sourced in this phase; replacement remains centralized through this map.
 */
export const serviceMedia = {
  "parcel-detail": fromHomepageMedia(
    "parcel-detail",
    homepageMedia.hero.parcelDetail,
    ["EVERYDAY_MOVEMENT", "QUOTE_INTELLIGENCE"],
    ["/services", "/services/parcel", "/services/pricing"],
    "Tactile parcel detail only; the crop must avoid readable paper content.",
  ),
  "parcel-handoff": fromHomepageMedia(
    "parcel-handoff",
    homepageMedia.documentary[2],
    ["EVERYDAY_MOVEMENT"],
    ["/services/parcel", "/services/pharmacy"],
    "Hands and device are visible; do not imply prescription, identity, or live-status data.",
  ),
  "food-grocery-preparation": fromHomepageMedia(
    "food-grocery-preparation",
    homepageMedia.services[1],
    ["EVERYDAY_MOVEMENT"],
    ["/services/food", "/services/grocery"],
    "Generic courier preparation image; it does not prove food-safety handling or a named retailer relationship.",
  ),
  "business-dispatch": fromHomepageMedia(
    "business-dispatch",
    homepageMedia.services[0],
    ["BUSINESS_FLOW"],
    ["/services", "/services/business", "/services/ecommerce"],
    "Keep the far-right vehicle crop outside the visible image area because the source may show an unrelated mark.",
  ),
  "operations-preparation": fromHomepageMedia(
    "operations-preparation",
    homepageMedia.documentary[0],
    ["BUSINESS_FLOW", "PLANNED_MOVEMENT"],
    ["/services/ecommerce", "/services/moving"],
    "Worker and boxes are the visible purpose; stock styling remains a provisional limitation.",
  ),
  "freight-movement": fromHomepageMedia(
    "freight-movement",
    homepageMedia.services[3],
    ["PLANNED_MOVEMENT"],
    ["/services/moving", "/services/freight"],
    "Trolley movement supports planning context only; keep the possible bag mark outside the crop.",
  ),
  "driver-context": fromHomepageMedia(
    "driver-context",
    homepageMedia.network.driver,
    ["BUSINESS_FLOW"],
    ["/services/driver-network"],
    "Generic driver portrait; it is not an employment, earnings, or onboarding claim.",
  ),
  "store-preparation": fromHomepageMedia(
    "store-preparation",
    homepageMedia.network.store,
    ["BUSINESS_FLOW"],
    ["/services/business", "/services/ecommerce"],
    "Store preparation is contextual only and does not represent a named merchant or active marketplace listing.",
  ),
  "delivery-status-context": fromHomepageMedia(
    "delivery-status-context",
    homepageMedia.documentary[4],
    ["EVERYDAY_MOVEMENT", "QUOTE_INTELLIGENCE"],
    ["/services/pricing", "/services/pharmacy"],
    "Device image supports account-based order-status explanation; it must not suggest anonymous or live tracking.",
  ),
  "local-road-context": fromHomepageMedia(
    "local-road-context",
    homepageMedia.coverage,
    ["PLANNED_MOVEMENT"],
    ["/services/shuttle", "/services/freight"],
    "Local road context only; it does not establish a route, passenger service, or service-area guarantee.",
  ),
  "delivery-handoff": fromHomepageMedia(
    "delivery-handoff",
    homepageMedia.documentary[5],
    ["EVERYDAY_MOVEMENT"],
    ["/services/food", "/services/grocery", "/services/pharmacy"],
    "Doorway handoff is a generic delivery moment; it must not imply specialised handling or confirmation terms.",
  ),
} as const satisfies Record<ServiceMediaId, ServiceMediaAsset>;

export function getServiceMedia(id: ServiceMediaId): ServiceMediaAsset {
  return serviceMedia[id];
}

export const allServiceMedia = Object.values(serviceMedia);
