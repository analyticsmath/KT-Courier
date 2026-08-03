import { homepageMedia, type HomepageMediaAsset } from "./homepage-media";

export type SupportingPageMediaId =
  | "about-operations"
  | "about-detail"
  | "coverage-context"
  | "membership-planning"
  | "careers-context"
  | "contact-preparation";

export type SupportingPageMediaAsset = Pick<
  HomepageMediaAsset,
  | "src"
  | "width"
  | "height"
  | "format"
  | "alt"
  | "decorative"
  | "focalPoint"
  | "desktop"
  | "tablet"
  | "mobile"
  | "provisional"
  | "sourceLedgerReference"
  | "status"
  | "replacementPriority"
> & {
  id: SupportingPageMediaId;
  pageUsages: readonly string[];
  visibleBrandReview: string;
};

function fromHomepageMedia(
  id: SupportingPageMediaId,
  source: HomepageMediaAsset,
  pageUsages: readonly string[],
  visibleBrandReview: string,
): SupportingPageMediaAsset {
  return {
    id,
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
    replacementPriority: source.replacementPriority,
    pageUsages,
    visibleBrandReview,
  };
}

/**
 * R7 uses only the previously reviewed local R2/R4 campaign library. These
 * records remain provisional and must be replaced through the existing ledger.
 */
export const supportingPageMedia = {
  "about-operations": fromHomepageMedia(
    "about-operations",
    homepageMedia.documentary[0],
    ["/about"],
    "Operations preparation context only; it does not depict named KT Couriers staff.",
  ),
  "about-detail": fromHomepageMedia(
    "about-detail",
    homepageMedia.hero.parcelDetail,
    ["/about"],
    "Parcel-handling detail only; crop avoids readable documentation.",
  ),
  "coverage-context": fromHomepageMedia(
    "coverage-context",
    homepageMedia.coverage,
    ["/coverage-areas"],
    "Local road context only; it is not a coverage map or a service-area guarantee.",
  ),
  "membership-planning": fromHomepageMedia(
    "membership-planning",
    homepageMedia.network.store,
    ["/membership"],
    "Store preparation context only; it does not establish a membership benefit or named merchant relationship.",
  ),
  "careers-context": fromHomepageMedia(
    "careers-context",
    homepageMedia.documentary[1],
    ["/careers"],
    "Operational work context only; it does not represent a current employee or a particular open role.",
  ),
  "contact-preparation": fromHomepageMedia(
    "contact-preparation",
    homepageMedia.services[0],
    ["/contact"],
    "Dispatch preparation context only; it does not prove a named business relationship or support location.",
  ),
} as const satisfies Record<SupportingPageMediaId, SupportingPageMediaAsset>;

export const allSupportingPageMedia = Object.values(supportingPageMedia);

export function getSupportingPageMedia(id: SupportingPageMediaId): SupportingPageMediaAsset {
  return supportingPageMedia[id];
}
