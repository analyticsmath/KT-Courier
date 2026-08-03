import { describe, expect, it } from "vitest"; import { assertProductTransition } from "@/lib/catalog/catalog-state-machines";
describe("moderation policy",()=>{it("requires submission before approval",()=>expect(()=>assertProductTransition("SUBMITTED","APPROVED")).not.toThrow());it("has no generic invalid override",()=>expect(()=>assertProductTransition("DRAFT","APPROVED")).toThrow());});

