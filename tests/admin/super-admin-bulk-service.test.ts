import {beforeEach,describe,it,expect,vi} from "vitest";
const m=vi.hoisted(()=>({store:vi.fn(),type:vi.fn(),category:vi.fn(),receiptFind:vi.fn(),receiptCreate:vi.fn(),audit:vi.fn(),query:vi.fn(),product:vi.fn()}));
vi.mock("@/lib/db/prisma",()=>({prisma:{store:{findFirst:m.store},productTypeDefinition:{findUnique:m.type},catalogCategory:{findUnique:m.category},$transaction:async(work:(tx:unknown)=>Promise<unknown>)=>work({$queryRaw:m.query,catalogOperationReceipt:{findUnique:m.receiptFind,create:m.receiptCreate},adminActivityLog:{create:m.audit}})}}));
vi.mock("@/lib/services/catalog-product.service",()=>({createStorePrivateCatalogProduct:m.product}));
import {importManagedCatalogDrafts} from "@/lib/super-admin/bulk-catalog";
const args={storeId:"s".repeat(23),productTypeDefinitionId:"t".repeat(23),primaryCategoryId:"c".repeat(23),csv:"title,shortDescription\nApples,Local apples\nOranges,Local oranges",operationId:"batch-20261025",dryRun:true};
beforeEach(()=>{vi.clearAllMocks();m.store.mockResolvedValue({id:args.storeId});m.type.mockResolvedValue({status:"ACTIVE"});m.category.mockResolvedValue({status:"ACTIVE"});m.receiptFind.mockResolvedValue(null);m.product.mockResolvedValue({id:"product-id"});});
describe("Super Admin atomic CSV import",()=>{
 it("validates the entire batch without persisting a product",async()=>{
  expect(await importManagedCatalogDrafts("super1",args)).toMatchObject({preview:true,count:2});
  expect(m.product).not.toHaveBeenCalled();expect(m.receiptCreate).not.toHaveBeenCalled();
 });
 it("writes only store-private drafts inside one transaction, with a durable replay receipt",async()=>{
  const result=await importManagedCatalogDrafts("super1",{...args,dryRun:false});
  expect(result).toMatchObject({preview:false,count:2,replayed:false});
  expect(m.product).toHaveBeenCalledTimes(2);
  expect(m.product.mock.calls[0][2]).toMatchObject({scope:"STORE_PRIVATE",title:"Apples"});
  expect(m.receiptCreate).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({action:"SUPER_ADMIN_BULK_PRODUCTS",storeId:args.storeId})}));
 });
 it("never recreates drafts when the same operation is safely replayed",async()=>{
  const {catalogRequestHash}=await import("@/lib/catalog/catalog-normalization");
  m.receiptFind.mockResolvedValue({requestHash:catalogRequestHash({storeId:args.storeId,productTypeDefinitionId:args.productTypeDefinitionId,primaryCategoryId:args.primaryCategoryId,rows:[{title:"Apples",shortDescription:"Local apples"},{title:"Oranges",shortDescription:"Local oranges"}]}),storeId:args.storeId,aggregateReference:"BULK-001"});
  expect(await importManagedCatalogDrafts("super1",{...args,dryRun:false})).toMatchObject({replayed:true});
  expect(m.product).not.toHaveBeenCalled();
 });
 it("fails closed before writes if any CSV row has unsafe content",async()=>{
  await expect(importManagedCatalogDrafts("super1",{...args,dryRun:false,csv:"title\nSafe item\n=SUM(1,2)"})).rejects.toBeDefined();
  expect(m.product).not.toHaveBeenCalled();
 });
});
