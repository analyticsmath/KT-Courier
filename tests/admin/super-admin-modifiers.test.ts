import { beforeEach,describe,expect,it,vi } from "vitest";
const f=vi.hoisted(()=>({findStore:vi.fn(),findOffer:vi.fn(),group:vi.fn(),attach:vi.fn()}));
vi.mock("@/lib/db/prisma",()=>({prisma:{$transaction:(cb:(tx:Record<string,unknown>)=>unknown)=>cb({}),store:{findFirst:f.findStore},storeCatalogOffer:{findFirst:f.findOffer}}}));
vi.mock("@/lib/services/catalog-modifier.service",()=>({createStoreModifierGroup:f.group,attachModifierGroup:f.attach}));
import {createManagedModifierGroup} from "@/lib/super-admin/modifier.service";
const params={storeId:"store-fixture-00000001",offerId:"offer-fixture-00000001",name:"Size option",minimumSelections:1,maximumSelections:1,isRequired:true,options:[{name:"Large",priceDelta:"12.50",currency:"ZAR",displayOrder:0}],operationId:"fixture-12345"};
beforeEach(()=>{vi.clearAllMocks();f.findStore.mockResolvedValue({id:params.storeId});f.findOffer.mockResolvedValue({id:params.offerId,status:"DRAFT"});f.group.mockResolvedValue({id:"group-id",name:params.name});});
describe("Super Admin priced attributes",()=>{
 it("attaches an attributable priced modifier only to an unpublished draft offer",async()=>{
  expect(await createManagedModifierGroup("super-1",params)).toMatchObject({id:"group-id"});
  expect(f.group).toHaveBeenCalledWith(params.storeId,"super-1",expect.objectContaining({name:"Size option"}),expect.anything());
  expect(f.attach).toHaveBeenCalledWith(params.storeId,params.offerId,"group-id",0,expect.anything());
 });
 it("blocks direct modification of a published active checkout offer",async()=>{
  f.findOffer.mockResolvedValue({id:params.offerId,status:"ACTIVE"});
  await expect(createManagedModifierGroup("super-1",params)).rejects.toMatchObject({code:"ACTIVE_PRICE_CHANGE_DENIED"});
  expect(f.group).not.toHaveBeenCalled();
 });
 it("blocks a malformed negative or arbitrary option price",async()=>{
  await expect(createManagedModifierGroup("super-1",{...params,options:[{...params.options[0],priceDelta:"-5.00"}]})).rejects.toMatchObject({code:"MODIFIER_INPUT_INVALID"});
  expect(f.attach).not.toHaveBeenCalled();
 });
});
