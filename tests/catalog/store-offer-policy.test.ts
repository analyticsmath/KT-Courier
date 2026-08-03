import { describe, expect, it } from "vitest"; import { assertOfferTransition } from "@/lib/catalog/catalog-state-machines";
describe("store offer lifecycle",()=>{it("allows draft submission and active pause",()=>{expect(()=>assertOfferTransition("DRAFT","SUBMITTED")).not.toThrow();expect(()=>assertOfferTransition("ACTIVE","PAUSED")).not.toThrow()});it("rejects archived reactivation",()=>expect(()=>assertOfferTransition("ARCHIVED","ACTIVE")).toThrow());});

