import { ktCourierImages } from "./kt-images";

export type VisualTone = "blue" | "amber" | "mint" | "lavender" | "cyan";

export interface StoryImage {
  label: string;
  title: string;
  alt: string;
  src: string;
  width: number;
  height: number;
  tone: VisualTone;
  size: "wide" | "tall" | "square";
}

export interface ServiceStory {
  title: string;
  eyebrow: string;
  description: string;
  href: string;
  cta: string;
  tone: VisualTone;
  layout: "featured" | "standard" | "panel" | "image";
}

export interface TrustProof {
  title: string;
  description: string;
  tone: VisualTone;
}

export const heroStatusItems = [
  "Request sent",
  "Pickup planned",
  "Status updated",
  "Delivered",
];

export const heroTrustChips = [
  "Same day requests",
  "Store deliveries",
  "Status updates",
  "Scheduled pickups",
];

export const storyImages: StoryImage[] = [
  {
    label: "Customer handoff",
    title: "Parcel delivery made visible",
    alt: ktCourierImages.parcelHandoffCustomer.alt,
    src: ktCourierImages.parcelHandoffCustomer.src,
    width: ktCourierImages.parcelHandoffCustomer.width,
    height: ktCourierImages.parcelHandoffCustomer.height,
    tone: "amber",
    size: "wide",
  },
  {
    label: "Store delivery",
    title: "Orders packed at the counter",
    alt: ktCourierImages.storeMerchandisePacking.alt,
    src: ktCourierImages.storeMerchandisePacking.src,
    width: ktCourierImages.storeMerchandisePacking.width,
    height: ktCourierImages.storeMerchandisePacking.height,
    tone: "mint",
    size: "tall",
  },
  {
    label: "Parcel ready",
    title: "Packed before pickup",
    alt: ktCourierImages.labelledParcel.alt,
    src: ktCourierImages.labelledParcel.src,
    width: ktCourierImages.labelledParcel.width,
    height: ktCourierImages.labelledParcel.height,
    tone: "cyan",
    size: "square",
  },
  {
    label: "Local movement",
    title: "South African city routes",
    alt: ktCourierImages.capeTownStreet.alt,
    src: ktCourierImages.capeTownStreet.src,
    width: ktCourierImages.capeTownStreet.width,
    height: ktCourierImages.capeTownStreet.height,
    tone: "blue",
    size: "tall",
  },
  {
    label: "Packed order",
    title: "Protected for drop off",
    alt: ktCourierImages.parcelPackingCloseUp.alt,
    src: ktCourierImages.parcelPackingCloseUp.src,
    width: ktCourierImages.parcelPackingCloseUp.width,
    height: ktCourierImages.parcelPackingCloseUp.height,
    tone: "lavender",
    size: "wide",
  },
  {
    label: "Route feel",
    title: "City movement with context",
    alt: ktCourierImages.capeTownRoute.alt,
    src: ktCourierImages.capeTownRoute.src,
    width: ktCourierImages.capeTownRoute.width,
    height: ktCourierImages.capeTownRoute.height,
    tone: "cyan",
    size: "wide",
  },
  {
    label: "Business counter",
    title: "Ready for courier pickup",
    alt: ktCourierImages.smallBusinessCounter.alt,
    src: ktCourierImages.smallBusinessCounter.src,
    width: ktCourierImages.smallBusinessCounter.width,
    height: ktCourierImages.smallBusinessCounter.height,
    tone: "mint",
    size: "tall",
  },
  {
    label: "Order prep",
    title: "Packed with clear details",
    alt: ktCourierImages.boxSealingPrep.alt,
    src: ktCourierImages.boxSealingPrep.src,
    width: ktCourierImages.boxSealingPrep.width,
    height: ktCourierImages.boxSealingPrep.height,
    tone: "amber",
    size: "square",
  },
  {
    label: "Handoff",
    title: "Parcel exchange",
    alt: ktCourierImages.handsExchangingPackages.alt,
    src: ktCourierImages.handsExchangingPackages.src,
    width: ktCourierImages.handsExchangingPackages.width,
    height: ktCourierImages.handsExchangingPackages.height,
    tone: "lavender",
    size: "wide",
  },
];

export const serviceStories: ServiceStory[] = [
  {
    title: "Same day delivery",
    eyebrow: "Urgent parcels",
    description:
      "Fast local delivery for urgent parcels and customer orders.",
    href: "/account/request-delivery",
    cta: "Request same day",
    tone: "blue",
    layout: "featured",
  },
  {
    title: "Scheduled delivery",
    eyebrow: "Planned pickups",
    description: "Plan pickups ahead for repeat delivery work.",
    href: "/account/request-delivery",
    cta: "Schedule delivery",
    tone: "amber",
    layout: "standard",
  },
  {
    title: "Business courier support",
    eyebrow: "Store workflows",
    description: "Give your store a cleaner way to manage delivery requests.",
    href: "/signup",
    cta: "Open account",
    tone: "mint",
    layout: "panel",
  },
  {
    title: "Parcel and document delivery",
    eyebrow: "Everyday essentials",
    description: "Send small parcels and documents with clear order status.",
    href: "/account/request-delivery",
    cta: "Send parcel",
    tone: "lavender",
    layout: "image",
  },
];

export const trustProofs: TrustProof[] = [
  {
    title: "Pickup and drop off details",
    description: "Each delivery request starts with the details your order needs.",
    tone: "blue",
  },
  {
    title: "Delivery status updates",
    description: "Customers and stores can follow status changes from their dashboard.",
    tone: "amber",
  },
  {
    title: "Admin reviewed requests",
    description: "Requests move through KT Couriers before fulfillment starts.",
    tone: "lavender",
  },
  {
    title: "Customer and store accounts",
    description: "Separate account areas support one-off and repeat delivery work.",
    tone: "mint",
  },
  {
    title: "Email confirmations",
    description: "Key request updates can reach users outside the dashboard.",
    tone: "cyan",
  },
];
