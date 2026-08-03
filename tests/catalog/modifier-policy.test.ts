import { describe, expect, it } from "vitest"; import { assertModifierGroup, assertModifierPrice } from "@/lib/catalog/catalog-modifier-policy";
describe("modifier policy",()=>{it("requires bounded required selection",()=>expect(()=>assertModifierGroup({minimumSelections:1,maximumSelections:2,isRequired:true})).not.toThrow());it("rejects recursive-like invalid bounds and negative deltas",()=>{expect(()=>assertModifierGroup({minimumSelections:2,maximumSelections:1,isRequired:true})).toThrow();expect(()=>assertModifierPrice({amount:"-1.00",currency:"ZAR"})).toThrow()});});

