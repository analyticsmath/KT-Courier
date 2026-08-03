import { describe,it,expect } from "vitest"; import { serviceSource,expectTransactionalEvidence } from "./catalog-service-source-test-helper";
describe("store price service",()=>it("validates exact periods and source-locks activation",()=>{const source=serviceSource("store-price.service.ts");expect(source).toMatch(/assertExactZarPrice/);expect(source).toMatch(/assertPricePeriod/);expect(source).toMatch(/assertCatalogProductionActivationAllowed\("PRICE"/);expect(()=>expectTransactionalEvidence(source)).not.toThrow()}));

