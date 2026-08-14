import type { StaticImageData } from "next/image";

export type StoryMediaStatus = "ASSIGNED" | "PENDING_FRONTEND_MEDIA";
export type StoryMedia = Readonly<{
  slot: string;
  alt: string;
  image: StaticImageData | null;
  objectPosition: string;
  status: StoryMediaStatus;
}>;

export const signatureMedia = {
  world: { slot: "world", alt: "A market aisle in natural morning light.", image: null, objectPosition: "50% 48%", status: "PENDING_FRONTEND_MEDIA" },
  threshold: { slot: "threshold", alt: "A florist closing the door to a flower shop.", image: null, objectPosition: "52% 50%", status: "PENDING_FRONTEND_MEDIA" },
  merchant: { slot: "merchant", alt: "An artisan working on handmade goods.", image: null, objectPosition: "50% 50%", status: "PENDING_FRONTEND_MEDIA" },
  tactile: { slot: "tactile", alt: "Hands holding a freshly made wrap.", image: null, objectPosition: "50% 50%", status: "PENDING_FRONTEND_MEDIA" },
  handoff: { slot: "handoff", alt: "A shopping bag being handed to a customer.", image: null, objectPosition: "50% 50%", status: "PENDING_FRONTEND_MEDIA" },
  movement: { slot: "movement", alt: "A shopper crossing a street with a bag as traffic blurs past.", image: null, objectPosition: "50% 52%", status: "PENDING_FRONTEND_MEDIA" },
  abundance: { slot: "abundance", alt: "Green apples arranged in a woven basket.", image: null, objectPosition: "50% 50%", status: "PENDING_FRONTEND_MEDIA" },
  discovery: { slot: "discovery", alt: "Customers browsing handmade crafts in a shop.", image: null, objectPosition: "50% 50%", status: "PENDING_FRONTEND_MEDIA" },
} as const satisfies Record<string, StoryMedia>;
