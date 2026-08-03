import { describe,it,expect } from "vitest"; import { serviceSource } from "./catalog-service-source-test-helper";
describe("catalog query service",()=>it("exposes immutable published snapshot boundary",()=>{const source=serviceSource("catalog-query.service.ts");expect(source).toMatch(/status:\s*"PUBLISHED"/);expect(source).toMatch(/publicationVersion/);expect(source).not.toMatch(/\.(create|update|delete)\(/)}));

