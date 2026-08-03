import { describe, expect, it } from "vitest"; import { productOptionFingerprint } from "@/lib/catalog/product-option-fingerprint";
describe("option fingerprint",()=>{it("is independent of input order and casing",()=>expect(productOptionFingerprint([{code:"Size",value:"Large"},{code:"Colour",value:"Black"}])).toBe(productOptionFingerprint([{code:"colour",value:"black"},{code:"size",value:"large"}])));it("rejects duplicate dimensions",()=>expect(()=>productOptionFingerprint([{code:"size",value:"s"},{code:"SIZE",value:"m"}])).toThrow(/unique/));});

