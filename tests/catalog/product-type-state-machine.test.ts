import { describe, expect, it } from "vitest"; import { assertProductTypeTransition } from "@/lib/catalog/catalog-state-machines";
describe("product type lifecycle",()=>{it("allows reviewed approval",()=>expect(()=>assertProductTypeTransition("UNDER_REVIEW","APPROVED")).not.toThrow());it("rejects active schema rollback",()=>expect(()=>assertProductTypeTransition("ACTIVE","DRAFT")).toThrow());});

