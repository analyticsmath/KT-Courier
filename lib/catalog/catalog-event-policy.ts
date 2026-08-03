import { stableJson } from "@/lib/catalog/catalog-normalization";

export const CATALOG_EVENT_MAX_PAYLOAD_BYTES = 16 * 1024;

export function assertCatalogEventPayload(payload: unknown): void {
  const serialized = stableJson(payload);
  if (Buffer.byteLength(serialized, "utf8") > CATALOG_EVENT_MAX_PAYLOAD_BYTES) {
    throw new Error("Catalog event payload is too large.");
  }
  const lowered = serialized.toLocaleLowerCase("en-ZA");
  if (["password", "requesthash", "operationid", "email", "phone"].some((key) => lowered.includes(`\"${key}\"`))) {
    throw new Error("Catalog event payload contains prohibited private evidence.");
  }
}

