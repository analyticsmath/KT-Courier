import { describe,it,expect } from "vitest"; import { serviceSource,expectTransactionalEvidence } from "./catalog-service-source-test-helper";
describe("store offer service",()=>it("separates offer and inventory item with ownership",()=>{const source=serviceSource("store-offer.service.ts");expect(source).toMatch(/inventoryItem:\s*\{\s*create/);expect(source).toMatch(/product\.sourceStoreId !== storeId/);expect(source).toMatch(/normalizeStoreSku/);expect(()=>expectTransactionalEvidence(source)).not.toThrow()}));

