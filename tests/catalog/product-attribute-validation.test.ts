import { describe, expect, it } from "vitest"; import { validateProductAttributeValues } from "@/lib/catalog/product-attribute-validation";
const schema={attributes:[{code:"size",label:"Size",type:"INTEGER" as const,required:true,minimum:1,maximum:10},{code:"colour",label:"Colour",type:"ENUM" as const,options:["red","blue"]}]};
describe("product attributes",()=>{it("validates schema values",()=>expect(validateProductAttributeValues(schema,{size:2,colour:"red"})).toEqual([]));it("rejects unknown and out-of-range values",()=>expect(validateProductAttributeValues(schema,{size:20,unknown:true})).toEqual(expect.arrayContaining([{code:"ATTRIBUTE_ABOVE_MAXIMUM",attributeCode:"size"},{code:"ATTRIBUTE_UNKNOWN",attributeCode:"unknown"}])));});

