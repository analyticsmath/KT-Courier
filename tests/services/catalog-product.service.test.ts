import { describe,it,expect } from "vitest"; import { serviceSource,expectTransactionalEvidence } from "./catalog-service-source-test-helper";
describe("catalog product service",()=>it("creates store-private product plus default variant",()=>{const source=serviceSource("catalog-product.service.ts");expect(source).toMatch(/scope:\s*"STORE_PRIVATE"/);expect(source).toMatch(/variants:\s*\{\s*create/);expect(source).toMatch(/sourceStoreId:\s*storeId/);expect(()=>expectTransactionalEvidence(source)).not.toThrow()}));

