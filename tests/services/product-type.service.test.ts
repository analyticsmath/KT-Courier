import { describe,it,expect } from "vitest"; import { serviceSource,expectTransactionalEvidence } from "./catalog-service-source-test-helper";
describe("product type service",()=>it("validates schemas, transitions and activation lock",()=>{const source=serviceSource("product-type.service.ts");expect(source).toMatch(/assertProductTypeSchemaBundle/);expect(source).toMatch(/assertCatalogProductionActivationAllowed/);expect(()=>expectTransactionalEvidence(source)).not.toThrow()}));

