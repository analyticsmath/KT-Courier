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
    path: "/images/kt-couriers/brand/kt-couriers-mark.svg",
    width: 64,
    height: 64,
    format: "svg",
    use: ["Brand documentation", "Compact-mark reference"],
    backgrounds: ["light", "dark"],
    status: "R10_DIGITAL_MARK",
    source: "R10 in-repository vector asset",
    hash: "sha256:bb405592867bf02a407890f8c91d2137e851cd5cc890505f28cffad67bfcc208",
    replacementNote: "Replace only with an approved brand asset; do not add trademark claims to the replacement.",
  },
  {
    id: "kt-r10-icon-route",
    path: "/icon",
    width: 512,
    height: 512,
    format: "route",
    use: ["Browser icon", "Manifest icon"],
    backgrounds: ["light", "dark"],
    status: "R10_PRODUCTION_BASELINE",
    source: "app/icon.tsx ImageResponse route",
    hash: "sha256:24ff2616757f144cbc794f3379cc600804b8acac4e4594a44c84269232fe1604 (route source)",
    replacementNote: "The rendered response is generated from the tracked source; retain 16px and 32px legibility.",
  },
  {
    id: "kt-r10-apple-icon-route",
    path: "/apple-icon",
    width: 180,
    height: 180,
    format: "route",
    use: ["Apple touch icon"],
    backgrounds: ["light", "dark"],
    status: "R10_PRODUCTION_BASELINE",
    source: "app/apple-icon.tsx ImageResponse route",
    hash: "sha256:7e506512375f773f5aa2230b0ced3750dd87fae17b4dcddbdf53c4b97727e376 (route source)",
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
    replacementNote: "Use only public, supportable copy and no provisional campaign photography.",
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
    replacementNote: "Replace with an approved ICO export that matches the R10 compact mark.",
  },
] as const satisfies readonly BrandAssetRecord[];
