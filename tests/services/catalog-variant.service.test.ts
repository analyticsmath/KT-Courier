import { describe,it,expect } from "vitest"; import { serviceSource,expectTransactionalEvidence } from "./catalog-service-source-test-helper";
describe("catalog variant service",()=>it("checks ownership, GTIN and fingerprint",()=>{const source=serviceSource("catalog-variant.service.ts");expect(source).toMatch(/sourceStoreId !== args\.storeId/);expect(source).toMatch(/validateGtin/);expect(source).toMatch(/productOptionFingerprint/);expect(()=>expectTransactionalEvidence(source)).not.toThrow()}));

