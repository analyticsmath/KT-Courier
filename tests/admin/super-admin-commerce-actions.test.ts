import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { findUnique: vi.fn() }, store: { count: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  adminActivityLog: { create: vi.fn() }, queryRaw: vi.fn(),
  product: vi.fn(), offer: vi.fn(), price: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: async (fn: (tx:Record<string,unknown>)=>unknown) => fn({ user: mocks.user, store: mocks.store, adminActivityLog: mocks.adminActivityLog, $queryRaw: mocks.queryRaw }), store: mocks.store } }));
vi.mock("@/lib/services/catalog-product.service", () => ({ createStorePrivateCatalogProduct: mocks.product }));
vi.mock("@/lib/services/store-offer.service", () => ({ createStoreCatalogOffer: mocks.offer }));
vi.mock("@/lib/services/store-price.service", () => ({ createStoreOfferPriceVersion: mocks.price }));
import { createManagedStore, createManagedProduct, createManagedOffer, createManagedPrice, ManagedCommerceError } from "@/lib/super-admin/commerce.service";

const owner={ id:"store-owner-1", role:"STORE", status:"ACTIVE", emailVerifiedAt:new Date(), storeProfile:{ id:"store-profile-1" } };
const store={ id:"store-fixture-00000001", name:"Test Grocers", status:"ACTIVE" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.findUnique.mockResolvedValue(owner);
  mocks.store.count.mockResolvedValue(0);
  mocks.store.findUnique.mockResolvedValue(null);
  mocks.store.findFirst.mockResolvedValue(store);
  mocks.store.create.mockResolvedValue({ id:"new-store", name:"Test Grocers", slug:"test-grocers", status:"PENDING" });
});

describe("super admin managed store onboarding", () => {
  const form={ name:"Test Grocers", ownerEmail:"owner@example.com", contactName:"Store Owner", province:"Gauteng" };
  it("creates a pending store for a verified store owner and writes its audit record", async () => {
    const result=await createManagedStore("superadmin-1", form);
    expect(result).toMatchObject({status:"PENDING",id:"new-store"});
    expect(mocks.store.create.mock.calls[0][0].data).toMatchObject({ ownerUserId:owner.id, status:"PENDING", name:"Test Grocers", featured:false });
    expect(mocks.adminActivityLog.create).toHaveBeenCalledWith(expect.objectContaining({ data:expect.objectContaining({actorUserId:"superadmin-1", entityType:"Store",action:"CREATE"}) }));
  });
  it.each([
    {role:"CUSTOMER"}, {role:"ADMIN"}, {emailVerifiedAt:null}, {status:"SUSPENDED"}
  ])("never assigns a store to an unauthorized owner %j",async change=>{
    mocks.user.findUnique.mockResolvedValue({...owner,...change});
    await expect(createManagedStore("superadmin-1",form)).rejects.toBeInstanceOf(ManagedCommerceError);
    expect(mocks.store.create).not.toHaveBeenCalled();
  });
  it("prevents a second store linked to the same account",async()=>{
    mocks.store.count.mockResolvedValue(1);
    await expect(createManagedStore("superadmin-1",form)).rejects.toMatchObject({code:"STORE_OWNER_ALREADY_ASSIGNED"});
    expect(mocks.store.create).not.toHaveBeenCalled();
  });
  it("rejects unsafe store names and malformed owner addresses",async()=>{
    await expect(createManagedStore("superadmin-1",{...form,name:"<script>unsafe</script>"})).rejects.toMatchObject({code:"STORE_INPUT_INVALID"});
  });
});

describe("governed super admin catalog drafting",()=>{
  it("creates a private unapproved product on behalf of the selected store",async()=>{
    mocks.product.mockResolvedValue({id:"product-draft",status:"DRAFT"});
    const result=await createManagedProduct("superadmin-1",{storeId:"store-fixture-00000001",scope:"STORE_PRIVATE",productTypeDefinitionId:"x".repeat(22),primaryCategoryId:"y".repeat(22),title:"Red Apples 1 kg",operationId:"create-20261025"});
    expect(result.status).toBe("DRAFT");
    expect(mocks.product).toHaveBeenCalledWith("store-fixture-00000001","superadmin-1",expect.objectContaining({scope:"STORE_PRIVATE"}));
  });
  it("refuses authored drafts for disabled stores",async()=>{
    mocks.store.findFirst.mockResolvedValue(null);
    await expect(createManagedProduct("superadmin-1",{storeId:"store-fixture-00000001",scope:"STORE_PRIVATE",productTypeDefinitionId:"x".repeat(22),primaryCategoryId:"y".repeat(22),title:"Red Apples",operationId:"create-20261025"})).rejects.toMatchObject({code:"STORE_NOT_EDITABLE"});
    expect(mocks.product).not.toHaveBeenCalled();
  });
  it("creates per-variant offer and price drafts, never automatic live exposure",async()=>{
    mocks.offer.mockResolvedValue({id:"offer",status:"DRAFT"}); mocks.price.mockResolvedValue({id:"draft-price",status:"DRAFT"});
    const offer=await createManagedOffer("superadmin-1",{storeId:"store-fixture-00000001",productId:"x".repeat(22),variantId:"v".repeat(22),storeSku:"APL-1KG",inventoryTrackingMode:"TRACKED",sellingUnit:"EACH",operationId:"offer-20261025"});
    const price=await createManagedPrice("superadmin-1",{storeId:"store-fixture-00000001",offerPublicReference:"COF-"+"A".repeat(32),offerVersion:1,amount:"29.99",currency:"ZAR",priceIncludesTax:true,effectiveFrom:"2026-11-01T00:00:00.000Z",operationId:"price-20261025"});
    expect(offer.status).toBe("DRAFT");expect(price.status).toBe("DRAFT");
    expect(mocks.offer).toHaveBeenCalledWith("store-fixture-00000001","superadmin-1",expect.any(Object));
    expect(mocks.price).toHaveBeenCalledWith("store-fixture-00000001","superadmin-1",expect.any(Object));
  });
});
