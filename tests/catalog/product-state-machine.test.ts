import { describe, expect, it } from "vitest"; import { assertProductTransition } from "@/lib/catalog/catalog-state-machines";
describe("product lifecycle",()=>{it("allows submit and reviewed approval",()=>{expect(()=>assertProductTransition("DRAFT","SUBMITTED")).not.toThrow();expect(()=>assertProductTransition("SUBMITTED","APPROVED")).not.toThrow()});it("does not allow draft activation",()=>expect(()=>assertProductTransition("DRAFT","ACTIVE")).toThrow());});

