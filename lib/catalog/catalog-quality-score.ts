export type CatalogQualityInput = {
  requiredAttributesComplete: boolean;
  hasIdentifier: boolean;
  titleLength: number;
  descriptionLength: number;
  mediaCount: number;
  allMediaHaveAltText: boolean;
  variantsComplete: boolean;
  complianceComplete: boolean;
  priceReady: boolean;
  inventoryReady: boolean;
};

const DIMENSIONS: Array<{ key: keyof CatalogQualityInput; points: number; issue: string; test?: (value: number) => boolean }> = [
  { key: "requiredAttributesComplete", points: 15, issue: "REQUIRED_ATTRIBUTES_INCOMPLETE" },
  { key: "hasIdentifier", points: 8, issue: "IDENTIFIER_MISSING" },
  { key: "titleLength", points: 8, issue: "TITLE_INCOMPLETE", test: (value) => value >= 5 && value <= 160 },
  { key: "descriptionLength", points: 8, issue: "DESCRIPTION_INCOMPLETE", test: (value) => value >= 40 },
  { key: "mediaCount", points: 12, issue: "MEDIA_MISSING", test: (value) => value >= 1 },
  { key: "allMediaHaveAltText", points: 7, issue: "MEDIA_ALT_TEXT_MISSING" },
  { key: "variantsComplete", points: 12, issue: "VARIANTS_INCOMPLETE" },
  { key: "complianceComplete", points: 12, issue: "COMPLIANCE_INCOMPLETE" },
  { key: "priceReady", points: 10, issue: "PRICE_NOT_READY" },
  { key: "inventoryReady", points: 8, issue: "INVENTORY_NOT_READY" },
];

export function calculateCatalogQuality(input: CatalogQualityInput): { score: number; issues: string[] } {
  let score = 0;
  const issues: string[] = [];
  for (const dimension of DIMENSIONS) {
    const value = input[dimension.key];
    const passed = dimension.test ? dimension.test(value as number) : value === true;
    if (passed) score += dimension.points;
    else issues.push(dimension.issue);
  }
  return { score, issues };
}

