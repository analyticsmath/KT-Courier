import { homepageMedia } from "@/lib/public-assets/homepage-media";

export type AuthMediaAsset = {
  id: string;
  src: `/${string}`;
  width: number;
  height: number;
  alt: string;
  focalPoint: `${number}% ${number}%`;
  sourceLedgerReference: string;
  provenanceStatus: "PROVISIONAL_R2";
  pageUsages: readonly string[];
  visibleBrandReview: string;
  recognizablePersonReview: string;
  replacementPriority: "MEDIUM" | "HIGH";
  provisional: true;
};

const preparationFrame = homepageMedia.documentary[0];

/**
 * Local-only imagery for the public authentication experience. The source
 * record remains in the R2 ledger; this registry adds R8-specific usage and
 * review notes without treating a provisional asset as production-ready.
 */
export const authMedia = {
  secureHandoff: {
    id: "AUTH-SECURE-HANDOFF-01",
    src: preparationFrame.src,
    width: preparationFrame.width,
    height: preparationFrame.height,
    alt: preparationFrame.alt,
    focalPoint: preparationFrame.focalPoint,
    sourceLedgerReference: preparationFrame.sourceLedgerReference,
    provenanceStatus: "PROVISIONAL_R2",
    pageUsages: ["Public authentication desktop supporting plane"],
    visibleBrandReview: "No competing mark observed in the intended crop.",
    recognizablePersonReview:
      "A worker is visible as part of the preparation action; the image remains provisional.",
    replacementPriority: "MEDIUM",
    provisional: true,
  },
} as const satisfies Record<string, AuthMediaAsset>;
