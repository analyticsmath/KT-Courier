import { describe,it,expect } from "vitest"; import { serviceSource,expectTransactionalEvidence } from "./catalog-service-source-test-helper";
describe("catalog category service",()=>it("uses cycle policy, optimistic version and evidence",()=>{const source=serviceSource("catalog-category.service.ts");expect(source).toMatch(/assertCategoryParentAllowed/);expect(source).toMatch(/updateMany[\s\S]*version/);expect(()=>expectTransactionalEvidence(source)).not.toThrow()}));

