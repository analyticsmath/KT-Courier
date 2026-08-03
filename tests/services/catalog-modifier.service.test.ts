import { describe,it,expect } from "vitest"; import { serviceSource,expectTransactionalEvidence } from "./catalog-service-source-test-helper";
describe("catalog modifier service",()=>it("uses flat owned groups and non-negative prices",()=>{const source=serviceSource("catalog-modifier.service.ts");expect(source).toMatch(/assertModifierGroup/);expect(source).toMatch(/assertModifierPrice/);expect(source).toMatch(/offer\.storeId !== storeId/);expect(()=>expectTransactionalEvidence(source)).not.toThrow()}));

