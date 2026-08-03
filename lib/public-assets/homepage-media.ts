export type HomepageMediaStatus = "PROVISIONAL_R2" | "PROVISIONAL_R4";
export type HeroMotionTreatment = "BOUNDED_CAMERA" | "ISOLATED_VEHICLE";

export type ResponsiveMediaVariant = {
  src: `/${string}`;
  width: number;
  height: number;
  aspectRatio: `${number} / ${number}`;
  objectPosition: `${number}% ${number}%`;
};

type HomepageMediaAsset = {
  id: string;
  src: `/${string}`;
  width: number;
  height: number;
  format: "webp";
  alt: string;
  decorative: boolean;
  focalPoint: `${number}% ${number}%`;
  objectPosition: `${number}% ${number}%`;
  desktopCrop: string;
  mobileCrop: string;
  cropIntent: string;
  artDirectionNote: string;
  treatment: "natural" | "cool-neutral" | "monochrome-detail";
  replacementPriority: "LOW" | "MEDIUM" | "HIGH";
  transparentBackground: boolean;
  dominantVisualRole: string;
  priority: boolean;
  motionTreatment?: HeroMotionTreatment;
  status: HomepageMediaStatus;
  desktop?: ResponsiveMediaVariant;
  tablet?: ResponsiveMediaVariant;
  mobile?: ResponsiveMediaVariant;
  provisional: true;
  sourceLedgerReference: string;
};

type HomepageMediaAssetInput = Omit<
  HomepageMediaAsset,
  | "format"
  | "objectPosition"
  | "cropIntent"
  | "artDirectionNote"
  | "treatment"
  | "replacementPriority"
  | "transparentBackground"
  | "dominantVisualRole"
  | "priority"
  | "status"
> &
  Partial<
    Pick<
      HomepageMediaAsset,
      | "format"
      | "objectPosition"
      | "cropIntent"
      | "artDirectionNote"
      | "treatment"
      | "replacementPriority"
      | "transparentBackground"
      | "dominantVisualRole"
      | "priority"
      | "status"
    >
  >;

const asset = (record: HomepageMediaAssetInput): HomepageMediaAsset => ({
  format: "webp",
  objectPosition: record.focalPoint,
  cropIntent: record.desktopCrop,
  artDirectionNote: "Provisional editorial candidate; see the media ledger before production approval.",
  treatment: "natural",
  replacementPriority: "MEDIUM",
  transparentBackground: false,
  dominantVisualRole: "supporting photography",
  priority: false,
  status: "PROVISIONAL_R2",
  ...record,
});

export const homepageMedia = {
  hero: {
    truck: asset({
      id: "R2-HERO-01",
      src: "/images/kt-couriers/provisional/r2/hero/r2-hero-01-truck.webp",
      width: 2200,
      height: 1467,
      alt: "A white box truck waiting at a loading dock.",
      decorative: false,
      focalPoint: "50% 55%",
      desktopCrop: "Truck remains the dominant right-side layer.",
      mobileCrop: "Truck is contained below the primary actions.",
      provisional: true,
      sourceLedgerReference: "#r2-hero-01",
      artDirectionNote: "Retained for provenance only. It does not meet the R4 signature-truck quality gate as a cutout.",
      replacementPriority: "HIGH",
      dominantVisualRole: "retired hero truck source",
    }),
    vehicle: asset({
      id: "R4-HERO-TRUCK-FRAME",
      status: "PROVISIONAL_R4",
      src: "/images/kt-couriers/provisional/r4/hero/r4-truck-desktop.webp",
      width: 1600,
      height: 1067,
      alt: "A box truck leaving a loading dock.",
      decorative: false,
      focalPoint: "53% 58%",
      desktopCrop: "Wide loading-dock frame; preserve the truck and doorway context.",
      mobileCrop: "Portrait dock crop; keep the vehicle immediately recognisable.",
      cropIntent: "A rectangular vehicle frame while a manually masked production truck remains outstanding.",
      artDirectionNote: "This is not a transparent cutout. The photograph remains inside a clearly bounded editorial stage.",
      treatment: "cool-neutral",
      replacementPriority: "HIGH",
      transparentBackground: false,
      dominantVisualRole: "signature truck frame",
      motionTreatment: "BOUNDED_CAMERA",
      priority: true,
      desktop: {
        src: "/images/kt-couriers/provisional/r4/hero/r4-truck-desktop.webp",
        width: 1600,
        height: 1067,
        aspectRatio: "1600 / 1067",
        objectPosition: "53% 58%",
      },
      tablet: {
        src: "/images/kt-couriers/provisional/r4/hero/r4-truck-tablet.webp",
        width: 1320,
        height: 990,
        aspectRatio: "4 / 3",
        objectPosition: "52% 58%",
      },
      mobile: {
        src: "/images/kt-couriers/provisional/r4/hero/r4-truck-mobile.webp",
        width: 920,
        height: 1100,
        aspectRatio: "23 / 27.5",
        objectPosition: "53% 58%",
      },
      provisional: true,
      sourceLedgerReference: "#r4-hero-truck-frame",
    }),
    environment: asset({
      id: "R4-HERO-ENVIRONMENT",
      status: "PROVISIONAL_R4",
      src: "/images/kt-couriers/provisional/r4/hero/r4-environment-desktop.webp",
      width: 2000,
      height: 1000,
      alt: "",
      decorative: true,
      focalPoint: "57% 62%",
      desktopCrop: "Wide commercial-road plane with an unobstructed route direction.",
      mobileCrop: "Tall city-road crop that keeps the street geometry legible.",
      cropIntent: "Supporting spatial plane only; it must not compete with the hero copy or truck frame.",
      artDirectionNote: "Derived from the R2 Johannesburg coverage source after the original hero environments failed the R4 relevance review.",
      treatment: "cool-neutral",
      replacementPriority: "LOW",
      transparentBackground: false,
      dominantVisualRole: "supporting local environment",
      desktop: {
        src: "/images/kt-couriers/provisional/r4/hero/r4-environment-desktop.webp",
        width: 2000,
        height: 1000,
        aspectRatio: "2 / 1",
        objectPosition: "57% 62%",
      },
      tablet: {
        src: "/images/kt-couriers/provisional/r4/hero/r4-environment-tablet.webp",
        width: 1500,
        height: 1000,
        aspectRatio: "3 / 2",
        objectPosition: "55% 62%",
      },
      mobile: {
        src: "/images/kt-couriers/provisional/r4/hero/r4-environment-mobile.webp",
        width: 920,
        height: 1120,
        aspectRatio: "23 / 28",
        objectPosition: "56% 62%",
      },
      provisional: true,
      sourceLedgerReference: "#r4-hero-environment",
    }),
    environmentDesktop: asset({
      id: "R2-HERO-02",
      src: "/images/kt-couriers/provisional/r2/hero/r2-hero-02-environment-desktop.webp",
      width: 2400,
      height: 1600,
      alt: "An urban road and commercial district in Johannesburg.",
      decorative: false,
      focalPoint: "56% 54%",
      desktopCrop: "Wide commercial-road plane behind the truck.",
      mobileCrop: "Not selected below the tablet breakpoint.",
      provisional: true,
      sourceLedgerReference: "#r2-hero-02",
    }),
    environmentMobile: asset({
      id: "R2-HERO-03",
      src: "/images/kt-couriers/provisional/r2/hero/r2-hero-03-environment-mobile.webp",
      width: 1500,
      height: 1001,
      alt: "A local market street with a delivery van in view.",
      decorative: false,
      focalPoint: "50% 50%",
      desktopCrop: "Not selected above the mobile breakpoint.",
      mobileCrop: "Short landscape continuation after the truck.",
      provisional: true,
      sourceLedgerReference: "#r2-hero-03",
    }),
    parcelDetail: asset({
      id: "R2-HERO-04",
      src: "/images/kt-couriers/provisional/r2/hero/r2-hero-04-parcel-detail.webp",
      width: 1600,
      height: 1067,
      alt: "A person preparing a parcel at a counter.",
      decorative: false,
      focalPoint: "50% 55%",
      desktopCrop: "Small tactile detail in the closing scene.",
      mobileCrop: "Cropped to the parcel and hands.",
      provisional: true,
      sourceLedgerReference: "#r2-hero-04",
    }),
  },
  documentary: [
    asset({ id: "R2-DOC-01", src: "/images/kt-couriers/provisional/r2/documentary/r2-doc-01-prepare.webp", width: 1600, height: 2000, alt: "A worker arranging boxes inside a delivery vehicle.", decorative: false, focalPoint: "50% 55%", desktopCrop: "Tall preparation frame.", mobileCrop: "Tall frame keeps the hands and boxes visible.", provisional: true, sourceLedgerReference: "#r2-doc-01" }),
    asset({ id: "R2-DOC-02", src: "/images/kt-couriers/provisional/r2/documentary/r2-doc-02-driver-arrival.webp", width: 1600, height: 1068, alt: "A driver walking beside a white delivery van.", decorative: false, focalPoint: "56% 50%", desktopCrop: "Wide arrival frame.", mobileCrop: "Driver remains in the left third.", provisional: true, sourceLedgerReference: "#r2-doc-02" }),
    asset({ id: "R2-DOC-03", src: "/images/kt-couriers/provisional/r2/documentary/r2-doc-03-pickup.webp", width: 1600, height: 1068, alt: "A courier recording a parcel handoff.", decorative: false, focalPoint: "55% 62%", desktopCrop: "Crop below the document details.", mobileCrop: "Handoff and device stay in view.", provisional: true, sourceLedgerReference: "#r2-doc-03" }),
    asset({ id: "R2-DOC-04", src: "/images/kt-couriers/provisional/r2/documentary/r2-doc-04-transit.webp", width: 1600, height: 1067, alt: "A delivery truck travelling along a road.", decorative: false, focalPoint: "45% 55%", desktopCrop: "Truck leads the horizontal frame.", mobileCrop: "Keep the cab and road line visible.", provisional: true, sourceLedgerReference: "#r2-doc-04" }),
    asset({ id: "R2-DOC-05", src: "/images/kt-couriers/provisional/r2/documentary/r2-doc-05-tracking.webp", width: 1600, height: 1068, alt: "A customer confirming a delivery on a handheld device.", decorative: false, focalPoint: "50% 55%", desktopCrop: "Device and handoff detail.", mobileCrop: "Device remains centred.", provisional: true, sourceLedgerReference: "#r2-doc-05" }),
    asset({ id: "R2-DOC-06", src: "/images/kt-couriers/provisional/r2/documentary/r2-doc-06-handoff.webp", width: 1600, height: 1068, alt: "A customer receiving a parcel at a doorway.", decorative: false, focalPoint: "52% 52%", desktopCrop: "Doorway handoff frame.", mobileCrop: "People and parcel remain visible.", provisional: true, sourceLedgerReference: "#r2-doc-06" }),
  ],
  services: [
    asset({ id: "R2-SVC-01", src: "/images/kt-couriers/provisional/r2/services/r2-svc-01-business.webp", width: 1600, height: 1067, alt: "Boxes loaded into a delivery van for business fulfilment.", decorative: false, focalPoint: "30% 55%", desktopCrop: "Crop away from the vehicle branding at the far right.", mobileCrop: "Focus on the open cargo area and boxes.", provisional: true, sourceLedgerReference: "#r2-svc-01" }),
    asset({ id: "R2-SVC-02", src: "/images/kt-couriers/provisional/r2/services/r2-svc-02-local-delivery.webp", width: 1600, height: 2400, alt: "A courier preparing grocery bags for a local delivery.", decorative: false, focalPoint: "50% 45%", desktopCrop: "Portrait delivery panel.", mobileCrop: "Keep the grocery bags in frame.", provisional: true, sourceLedgerReference: "#r2-svc-02" }),
    asset({ id: "R2-SVC-03", src: "/images/kt-couriers/provisional/r2/services/r2-svc-03-parcel.webp", width: 1600, height: 1068, alt: "Parcels prepared inside the open rear of a delivery van.", decorative: false, focalPoint: "50% 55%", desktopCrop: "Cargo area and parcels.", mobileCrop: "Cargo area remains central.", provisional: true, sourceLedgerReference: "#r2-svc-03" }),
    asset({ id: "R2-SVC-04", src: "/images/kt-couriers/provisional/r2/services/r2-svc-04-moving-freight.webp", width: 1600, height: 2400, alt: "A worker moving a loaded delivery trolley.", decorative: false, focalPoint: "48% 55%", desktopCrop: "Trolley and worker crop avoids the bag mark.", mobileCrop: "Trolley movement stays legible.", provisional: true, sourceLedgerReference: "#r2-svc-04" }),
  ],
  network: {
    store: asset({ id: "R2-NET-01", src: "/images/kt-couriers/provisional/r2/network/r2-net-01-store.webp", width: 1600, height: 1067, alt: "A shopkeeper packing a customer order at a counter.", decorative: false, focalPoint: "55% 52%", desktopCrop: "Wide operational panel.", mobileCrop: "Keep the packing action visible.", provisional: true, sourceLedgerReference: "#r2-net-01" }),
    driver: asset({ id: "R2-NET-02", src: "/images/kt-couriers/provisional/r2/network/r2-net-02-driver.webp", width: 1600, height: 2400, alt: "A delivery driver seated in a vehicle.", decorative: false, focalPoint: "48% 45%", desktopCrop: "Tall driver portrait.", mobileCrop: "Driver remains in the upper frame.", provisional: true, sourceLedgerReference: "#r2-net-02" }),
  },
  marketplace: {
    storefront: asset({ id: "R2-MKT-01", src: "/images/kt-couriers/provisional/r2/marketplace/r2-mkt-01-storefront.webp", width: 1600, height: 2400, alt: "People entering an independent retail storefront.", decorative: false, focalPoint: "52% 45%", desktopCrop: "Tall storefront panel.", mobileCrop: "Entrance remains visible.", provisional: true, sourceLedgerReference: "#r2-mkt-01" }),
    fulfilment: asset({ id: "R2-MKT-02", src: "/images/kt-couriers/provisional/r2/marketplace/r2-mkt-02-fulfilment.webp", width: 1600, height: 1067, alt: "A retailer preparing a packed order.", decorative: false, focalPoint: "50% 55%", desktopCrop: "Wide backroom preparation panel.", mobileCrop: "Packing action stays central.", provisional: true, sourceLedgerReference: "#r2-mkt-02" }),
  },
  coverage: asset({
    id: "R4-COV-01",
    status: "PROVISIONAL_R4",
    src: "/images/kt-couriers/provisional/r2/coverage/r2-cov-01-road-network.webp",
    width: 2200,
    height: 1467,
    alt: "Traffic moving through a commercial district in Johannesburg.",
    decorative: false,
    focalPoint: "52% 55%",
    desktopCrop: "Wide local road context.",
    mobileCrop: "Keep the road and buildings in view.",
    cropIntent: "Use the original wide asset on large screens and a distinct R4 mobile crop when the road geometry would otherwise become too small.",
    artDirectionNote: "The R4 mobile derivative is a crop of the documented R2 Johannesburg source, not a new coverage claim.",
    treatment: "cool-neutral",
    replacementPriority: "LOW",
    dominantVisualRole: "coverage context",
    desktop: {
      src: "/images/kt-couriers/provisional/r2/coverage/r2-cov-01-road-network.webp",
      width: 2200,
      height: 1467,
      aspectRatio: "3 / 2",
      objectPosition: "52% 55%",
    },
    mobile: {
      src: "/images/kt-couriers/provisional/r4/coverage/r4-coverage-mobile.webp",
      width: 960,
      height: 1040,
      aspectRatio: "12 / 13",
      objectPosition: "55% 63%",
    },
    provisional: true,
    sourceLedgerReference: "#r4-coverage",
  }),
} as const;

export type { HomepageMediaAsset };
