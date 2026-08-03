import { describe,it,expect } from "vitest"; import { serviceSource } from "./catalog-service-source-test-helper";
describe("catalog duplicate service",()=>it("detects and reviews without destructive merge",()=>{const source=serviceSource("catalog-duplicate.service.ts");expect(source).toMatch(/detectDuplicateSignals/);expect(source).not.toMatch(/catalogProduct\.(delete|deleteMany)/);expect(source).toMatch(/MERGE_REVIEW_REQUESTED/)}));

