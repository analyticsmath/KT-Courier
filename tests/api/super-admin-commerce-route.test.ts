import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const f = vi.hoisted(() => ({ auth:vi.fn(), prepared:vi.fn(), store:vi.fn(), product:vi.fn(), offer:vi.fn(), price:vi.fn() }));
vi.mock("@/lib/auth/admin-api",()=>({requireSuperAdminApi:f.auth}));
vi.mock("@/lib/catalog/catalog-api-policy",async(importOriginal)=>({...await importOriginal<typeof import("@/lib/catalog/catalog-api-policy")>(),prepareCatalogMutation:f.prepared}));
vi.mock("@/lib/super-admin/commerce.service",()=>({
  ManagedCommerceError: class ManagedCommerceError extends Error { code="DENIED";status=409; },
  createManagedStore:f.store,createManagedProduct:f.product,createManagedOffer:f.offer,createManagedPrice:f.price,
}));
import { POST } from "@/app/api/admin/super-admin/commerce/route";
const request = new NextRequest("https://example.test/api/admin/super-admin/commerce", {method:"POST",headers:{"content-type":"application/json"},body:"{}"});
beforeEach(()=>{vi.resetAllMocks();f.auth.mockResolvedValue({user:{id:"super-1",role:"SUPER_ADMIN"}});});
describe("super admin commerce endpoint",()=>{
 it("refuses all mutations without authorized super-admin context",async()=>{
  f.auth.mockResolvedValue({response:NextResponse.json({error:"forbidden"},{status:403})});
  const response=await POST(request);expect(response.status).toBe(403);expect(f.prepared).not.toHaveBeenCalled();expect(f.store).not.toHaveBeenCalled();
 });
 it("creates a pending store but does not approve it",async()=>{
  f.prepared.mockResolvedValue({body:{action:"CREATE_STORE",data:{name:"Managed Grocery",ownerEmail:"owner@example.test",contactName:"Owner"}}});
  f.store.mockResolvedValue({id:"store-id",status:"PENDING"});
  const response=await POST(request);expect(response.status).toBe(201);expect(await response.json()).toMatchObject({store:{status:"PENDING"}});
  expect(f.store).toHaveBeenCalledWith("super-1",expect.any(Object));
 });
 it("does not accept an unrecognized commercial activation operation",async()=>{
  f.prepared.mockResolvedValue({body:{action:"ACTIVATE_ADVERTISING",data:{}}});
  const response=await POST(request);expect(response.status).toBe(422);expect(f.store).not.toHaveBeenCalled();
 });
 it("creates only a product draft through the canonical service",async()=>{
  f.prepared.mockResolvedValue({body:{action:"CREATE_PRODUCT_DRAFT",data:{storeId:"store-id"}}});
  f.product.mockResolvedValue({id:"product",status:"DRAFT"});
  expect((await (await POST(request)).json()).product.status).toBe("DRAFT");
 });
});
