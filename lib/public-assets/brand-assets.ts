export type BrandAssetStatus =
  | "R10_DIGITAL_MARK"
  | "R10_PRODUCTION_BASELINE"
  | "PROVISIONAL"
  | "REPLACEMENT_REQUIRED";

export type BrandAssetRecord = {
  id: string;
  path: `/${string}`;
  width: number | null;
  height: number | null;
  format: "svg" | "png" | "ico" | "route";
  use: readonly string[];
  backgrounds: readonly ("light" | "dark")[];
  status: BrandAssetStatus;
  source: string;
  hash: string | null;
  replacementNote: string;
};

/** Public web assets only. The R10 mark is a digital utility mark, not a registration claim. */
export const brandAssets = [
  {
    id: "kt-r10-compact-mark-source",
    path: "/images/kt-couriers/brand/logo.svg",
    width: 1024,
    height: 1024,
    format: "svg",
    use: ["Brand documentation", "Compact-mark reference"],
    backgrounds: ["light", "dark"],
    status: "R10_DIGITAL_MARK",
    source: "Existing in-repository KT Couriers vector asset",
    hash: null,
    replacementNote:
      "Replace only with an approved brand asset; do not add trademark claims to the replacement.",
  },
  {
    id: "kt-r10-icon-route",
    path: "/images/kt-couriers/brand/icon-512.png",
    width: 512,
    height: 512,
    format: "png",
    use: ["Browser icon", "Manifest icon"],
    backgrounds: ["light", "dark"],
    status: "R10_PRODUCTION_BASELINE",
    source: "Tracked public KT Couriers icon-512.png asset",
    hash: null,
    replacementNote:
      "Retain 16px and 32px legibility when replacing the tracked icon.",
  },
  {
    id: "kt-r10-apple-icon-route",
    path: "/apple-icon.png",
    width: 180,
    height: 180,
    format: "png",
    use: ["Apple touch icon"],
    backgrounds: ["light", "dark"],
    status: "R10_PRODUCTION_BASELINE",
    source: "Tracked Next metadata app/apple-icon.png asset",
    hash: null,
    replacementNote: "Keep the mark centered with a safe margin.",
  },
  {
    id: "kt-r10-default-open-graph",
    path: "/opengraph-image",
    width: 1200,
    height: 630,
    format: "route",
    use: ["Default Open Graph", "Default Twitter card"],
    backgrounds: ["light"],
    status: "R10_PRODUCTION_BASELINE",
    source: "app/opengraph-image.tsx ImageResponse route",
    hash: "sha256:1ea4b8f1e56b622a4591616842c7a261240627164bd8f2e8c7f2c82ac3aaae05 (route source)",
    replacementNote:
      "Use only public, supportable copy and no provisional campaign photography.",
  },
  {
    id: "legacy-favicon",
    path: "/favicon.ico",
    width: null,
    height: null,
    format: "ico",
    use: ["Legacy favicon fallback"],
    backgrounds: ["light", "dark"],
    status: "REPLACEMENT_REQUIRED",
    source: "Pre-existing repository file",
    hash: "sha256:2b8ad2d33455a8f736fc3a8ebf8f0bdea8848ad4c0db48a2833bd0f9cd775932",
    replacementNote:
      "Replace with an approved ICO export that matches the R10 compact mark.",
  },
] as const satisfies readonly BrandAssetRecord[];
