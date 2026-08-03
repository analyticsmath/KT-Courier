import { describe, expect, it } from "vitest"; import { calculateCatalogQuality } from "@/lib/catalog/catalog-quality-score";
const complete={requiredAttributesComplete:true,hasIdentifier:true,titleLength:20,descriptionLength:100,mediaCount:2,allMediaHaveAltText:true,variantsComplete:true,complianceComplete:true,priceReady:true,inventoryReady:true};
describe("quality score",()=>{it("is deterministic and explainable",()=>expect(calculateCatalogQuality(complete)).toEqual({score:100,issues:[]}));it("remains advisory with individual issues",()=>expect(calculateCatalogQuality({...complete,complianceComplete:false})).toEqual({score:88,issues:["COMPLIANCE_INCOMPLETE"]}));});

