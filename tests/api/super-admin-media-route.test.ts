import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const f = vi.hoisted(() => ({ auth: vi.fn(), body: vi.fn(), findStore: vi.fn(), createIntent: vi.fn(), complete: vi.fn(), getAsset: vi.fn(), attach: vi.fn(), bytes: vi.fn() }));
vi.mock("@/lib/auth/admin-api", () => ({ requireSuperAdminApi: f.auth }));
vi.mock("@/lib/catalog/catalog-api-policy", async original => ({
  ...await original<typeof import("@/lib/catalog/catalog-api-policy")>(),
  prepareCatalogMutation: f.body, prepareCatalogMediaStream: f.bytes,
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { store: { findFirst: f.findStore } } }));
vi.mock("@/lib/services/catalog-media-intake.service", () => ({ createProductionCatalogMediaIntakeService: () => ({ createUploadIntent: f.createIntent, completeUpload: f.complete, getStoreAsset: f.getAsset, receiveUploadBytes: f.bytes }) }));
vi.mock("@/lib/services/catalog-media-attachment.service", () => ({ attachStoreCatalogMedia: f.attach }));
import { POST as POST_MEDIA } from "@/app/api/admin/super-admin/media/route";
import { POST as POST_BYTES } from "@/app/api/admin/super-admin/media/[reference]/content/route";
const ref = `CMU-${"A".repeat(32)}`, asset=`CMA-${"A".repeat(32)}`,product=`CP-${"A".repeat(32)}`;
const storeId="s".repeat(23);
const req = new NextRequest("https://example.test/api/admin/super-admin/media", { method: "POST", headers:{"content-type":"application/json"}, body:"{}" });
beforeEach(()=>{vi.clearAllMocks();f.auth.mockResolvedValue({user:{id:"super-1",role:"SUPER_ADMIN"}});f.findStore.mockResolvedValue({id:storeId});});
describe("Super Admin store media ownership and moderation", () => {
  it("requires a Super Admin context before reading upload intent",async()=>{
    f.auth.mockResolvedValue({response:NextResponse.json({error:"Forbidden"},{status:403})});
    expect((await POST_MEDIA(req)).status).toBe(403);
    expect(f.body).not.toHaveBeenCalled();
  });
  it("does not create upload intents for disabled stores",async()=>{
    f.findStore.mockResolvedValue(null);
    f.body.mockResolvedValue({body:{action:"START_MEDIA_UPLOAD",data:{storeId,purpose:"PRODUCT_IMAGE",declaredMimeType:"image/png",declaredByteSize:100,operationId:"media-unit-100"}}});
    expect((await POST_MEDIA(req)).status).toBe(409);
    expect(f.createIntent).not.toHaveBeenCalled();
  });
  it("requires a READY asset from the selected store before attachment",async()=>{
    f.body.mockResolvedValue({body:{action:"ATTACH_READY_MEDIA",data:{storeId,assetPublicReference:asset,productReference:product,productVersion:1,altText:"Local apples in reusable bag",operationId:"attach-unit-100"}}});
    f.getAsset.mockResolvedValue({status:"QUARANTINED"});
    expect((await POST_MEDIA(req)).status).toBe(409);
    expect(f.attach).not.toHaveBeenCalled();
  });
  it("blocks raw media upload without a valid store context",async()=>{
    const bytes = new NextRequest(`https://example.test/api/admin/super-admin/media/${ref}/content`,{method:"POST",headers:{"content-type":"application/octet-stream","x-catalog-operation-id":"valid-128"},body:new Uint8Array([137,80,78,71])});
    expect((await POST_BYTES(bytes,{params:Promise.resolve({reference:ref})})).status).toBe(422);
    expect(f.bytes).not.toHaveBeenCalled();
  });
});
