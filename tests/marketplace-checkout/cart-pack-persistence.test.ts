import { describe, expect, it } from "vitest";
import { cartRowToState, cartStateToGroupCreateData } from "@/lib/marketplace-checkout/prisma-cart-repository";

describe("marketplace cart package financial snapshot", () => {
  const row={id:"cart",publicReference:"cart-ref",ownerType:"CUSTOMER",customerUserId:"buyer",status:"ACTIVE",version:1,storeGroups:[{
    storeId:"store",fulfilmentMode:"COURIER_DELIVERY",lines:[{
      publicReference:"cart-line",productPublicReference:"product",variantPublicReference:"variant",offerPublicReference:"offer",
      quantity:4,observedSellingUnit:"PACK",observedPublicationVersion:"pub-1",observedPriceVersion:"price-1",
      observedUnitPrice:{toFixed:()=>"75.00"},lineFingerprint:"fingerprint",modifiers:[],
    }],
  }]};
  it("restores a separately stocked PACK SKU without converting it to individual units", () => {
    const cart=cartRowToState(row);
    expect(cart.lines[0]).toMatchObject({quantity:4,selection:{quantity:4,sellingUnit:"PACK",unitPrice:"75.00"}});
  });
  it("writes the current selling unit into the immutable observed cart line", () => {
    const cart=cartRowToState(row);
    const persisted=cartStateToGroupCreateData(cart);
    expect(persisted[0]?.lines.create[0]).toMatchObject({observedSellingUnit:"PACK",quantity:4,observedUnitPrice:"75.00"});
  });
});
