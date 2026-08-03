import { describe, expect, it } from "vitest"; import { inventoryProjection, assertPhase18ReservedInventory } from "@/lib/catalog/catalog-inventory-policy";
describe("inventory projections",()=>{it("derives available stock",()=>expect(inventoryProjection(4,0)).toEqual({onHand:4,reserved:0,available:4}));it("rejects invalid projection",()=>expect(()=>inventoryProjection(1,2)).toThrow());it("keeps reservations out of Phase 18",()=>expect(()=>assertPhase18ReservedInventory(1)).toThrow(/not available/));});

