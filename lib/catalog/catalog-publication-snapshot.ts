import { catalogRequestHash, stableJson } from "@/lib/catalog/catalog-normalization";

export type CatalogPublicationSnapshotValue = {
  productReference: string;
  variantReference: string;
  offerReference: string;
  storeReference: string;
  productTypeCode: string;
  productTypeVersion: number;
  categoryPath: string;
  title: string;
  description: string;
  brand?: string;
  identifiers: Record<string, string>;
  attributes: Record<string, unknown>;
  variantOptions: Record<string, string>;
  price: { versionReference: string; amount: string; currency: "ZAR"; includesTax: true };
  availability: Record<string, unknown>;
  media: Array<{ assetReference: string; role: string; altText: string; order: number }>;
  compliance: Record<string, unknown>;
  publicationVersion: string;
};

export function buildCatalogPublicationSnapshot(
  input: Omit<CatalogPublicationSnapshotValue, "publicationVersion">,
): CatalogPublicationSnapshotValue {
  const safe = JSON.parse(stableJson(input)) as Omit<CatalogPublicationSnapshotValue, "publicationVersion">;
  return { ...safe, publicationVersion: catalogRequestHash(safe) };
}

export function assertSnapshotContainsNoPrivateKeys(snapshot: unknown): void {
  const source = stableJson(snapshot).toLocaleLowerCase("en-ZA");
  const prohibited = ["userid", "actoruserid", "operationid", "requesthash", "moderationnote", "email", "phone"];
  if (prohibited.some((key) => source.includes(`\"${key}\"`))) {
    throw new Error("Publication snapshot contains private catalog evidence.");
  }
}

