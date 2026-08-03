import { describe, expect, it } from "vitest"; import { assertCatalogEventPayload } from "@/lib/catalog/catalog-event-policy";
describe("catalog events",()=>{it("accepts bounded aggregate evidence",()=>expect(()=>assertCatalogEventPayload({productReference:"CP-A",status:"DRAFT"})).not.toThrow());it("rejects operation hashes and oversized payloads",()=>{expect(()=>assertCatalogEventPayload({requestHash:"secret"})).toThrow();expect(()=>assertCatalogEventPayload({value:"x".repeat(20_000)})).toThrow()});});

