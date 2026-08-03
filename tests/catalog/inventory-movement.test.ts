import { describe, expect, it } from "vitest"; import { applyInventoryDelta } from "@/lib/catalog/catalog-inventory-policy";
describe("inventory movements",()=>{it("projects receipts and damage",()=>{const received=applyInventoryDelta({onHand:0,reserved:0,available:0},5);expect(applyInventoryDelta(received,-2)).toEqual({onHand:3,reserved:0,available:3})});it("rejects zero and negative stock",()=>{expect(()=>applyInventoryDelta({onHand:1,reserved:0,available:1},0)).toThrow();expect(()=>applyInventoryDelta({onHand:1,reserved:0,available:1},-2)).toThrow()});});

