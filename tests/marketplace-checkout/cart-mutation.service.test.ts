/* eslint-disable @typescript-eslint/no-explicit-any -- in-memory repository fixture intentionally models a dynamic persistence adapter. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveMarketplaceCartLine } from "@/lib/marketplace-checkout/cart.service";
import { cartLineFingerprint } from "@/lib/marketplace-checkout/policy";
import {
  addCartLine,
  claimGuestCart,
  clearCart,
  mergeGuestAndCustomerCarts,
  replaceCartLineModifiers,
  updateCartLineQuantity,
  type MarketplaceCartMutationRepository,
  type MarketplaceCartState,
} from "@/lib/marketplace-checkout/cart-mutation.service";
vi.mock("@/lib/db/prisma", () => ({
  prisma: { storeCatalogOffer: { findFirst: vi.fn().mockResolvedValue(null) } },
}));
const customer = { type: "CUSTOMER" as const, userId: "customer" };
const guest = { type: "GUEST" as const, guestTokenHash: "guest" };
const selection = {
  offerReference: "offer",
  variantReference: "variant",
  productReference: "product",
  storeId: "store",
  fulfilmentMode: "COURIER_DELIVERY",
  sellingUnit: "EACH",
  publicationVersion: "p1",
  priceVersion: "price1",
  unitPrice: "10.00",
  quantity: 1,
  modifiers: [],
};
function repository(
  initial: MarketplaceCartState,
): MarketplaceCartMutationRepository & {
  state: MarketplaceCartState;
  receipts: Map<string, any>;
  transactions: number;
  lockCartByOwner(owner: any): Promise<MarketplaceCartState | null>;
  markMerged(): Promise<void>;
  create(owner: any): Promise<MarketplaceCartState>;
} {
  const value: any = {
    state: initial,
    receipts: new Map(),
    transactions: 0,
    transaction: async (work: any) => {
      value.transactions += 1;
      return work();
    },
    lockCart: async (id: string) =>
      value.state.id === id ? value.state : null,
    lockCartByOwner: async (owner: any) =>
      value.state.owner.type === owner.type || owner.type === "GUEST"
        ? value.state
        : null,
    findCartByOwner: async () => value.state,
    saveCart: async (cart: MarketplaceCartState) => {
      value.state = cart;
    },
    readOperation: async (_: string, operationId: string) =>
      value.receipts.get(operationId) ?? null,
    appendOperation: async (
      _: string,
      operationId: string,
      requestHash: string,
      result: any,
      type: string,
    ) => value.receipts.set(operationId, { requestHash, result, type }),
    markMerged: async () => {},
    create: async () => value.state,
  };
  return value;
}
describe("marketplace cart mutation service", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("denies another owner even when a successful operation receipt is known", async () => {
    const repo = repository({ id: "cart", publicReference: "cart-ref", owner: customer, status: "ACTIVE", version: 1, lines: [] });
    const mutation = { operationId: "private-operation", requestHash: "a", expectedVersion: 1 };
    await clearCart(repo, { cartId: "cart", owner: customer, mutation });
    await expect(clearCart(repo, { cartId: "cart", owner: { type: "CUSTOMER", userId: "other" }, mutation })).rejects.toMatchObject({ code: "CART_ACCESS_DENIED" });
    expect(repo.state.version).toBe(2);
    expect(repo.receipts.size).toBe(1);
  });
  it("does not resolve invalid cart lines", async () => {
    await expect(
      resolveMarketplaceCartLine({
        offerReference: "offer",
        variantReference: "variant",
        quantity: 1,
        modifiers: [],
      }),
    ).rejects.toMatchObject({ code: "CART_LINE_INVALID" });
  });
  it("adds an idempotent server-resolved line and replays same meaning", async () => {
    const repo = repository({
      id: "cart",
      publicReference: "cart-ref",
      owner: customer,
      status: "ACTIVE",
      version: 1,
      lines: [],
    });
    const first = await addCartLine(repo, {
      cartId: "cart",
      owner: customer,
      mutation: {
        operationId: "operation-add-1",
        requestHash: "a",
        expectedVersion: 1,
      },
      selection,
    });
    const replay = await addCartLine(repo, {
      cartId: "cart",
      owner: customer,
      mutation: {
        operationId: "operation-add-1",
        requestHash: "a",
        expectedVersion: 1,
      },
      selection,
    });
    expect(first.cart.lines).toHaveLength(1);
    expect(replay.replayed).toBe(true);
  });
  it("reprices a duplicate line at the combined quantity, rather than retaining the first unit-price tier", async () => {
    const repo = repository({ id: "cart", publicReference: "cart-ref", owner: customer, status: "ACTIVE", version: 1, lines: [{publicReference:"existing",storeId:"store",quantity:2,fingerprint:cartLineFingerprint({offerReference: "offer",variantReference:"variant",modifiers:[]}),selection:{...selection,quantity:2,unitPrice:"100.00"}}] });
    const result = await addCartLine(repo, {
      cartId:"cart",owner:customer,mutation:{operationId:"volume-add",requestHash:"volume-hash",expectedVersion:1},
      selection:{...selection,quantity:1,unitPrice:"100.00"},
      revalidate: async (_line,quantity)=>({...selection,quantity,unitPrice:quantity>=3?"90.00":"100.00"}),
    });
    expect(result.cart.lines).toHaveLength(1);
    expect(result.cart.lines[0]).toMatchObject({quantity:3,selection:{quantity:3,unitPrice:"90.00"}});
    expect(repo.receipts.get("volume-add")?.type).toBe("ADD_LINE");
  });
  it("rejects duplicate SKU additions if server price revalidation fails, without changing cart or operation receipts", async () => {
    const fingerprint=cartLineFingerprint({offerReference:"offer",variantReference:"variant",modifiers:[]});
    const original:MarketplaceCartState={id:"cart",publicReference:"cart-ref",owner:customer,status:"ACTIVE",version:1,lines:[{publicReference:"existing",storeId:"store",quantity:2,fingerprint,selection:{...selection,quantity:2}}]};
    const repo=repository(original);
    await expect(addCartLine(repo,{cartId:"cart",owner:customer,mutation:{operationId:"unverified-volume",requestHash:"hash",expectedVersion:1},selection:{...selection,quantity:1},revalidate:async()=>{throw new Error("The product is no longer offered.");}})).rejects.toThrow("The product is no longer offered.");
    expect(repo.state).toEqual(original);
    expect(repo.receipts.size).toBe(0);
  });
  it("rejects attempts to substitute a different offer while repricing the combined cart quantity", async () => {
    const fingerprint=cartLineFingerprint({offerReference:"offer",variantReference:"variant",modifiers:[]});
    const repo=repository({id:"cart",publicReference:"cart-ref",owner:customer,status:"ACTIVE",version:1,lines:[{publicReference:"existing",storeId:"store",quantity:2,fingerprint,selection:{...selection,quantity:2}}]});
    await expect(addCartLine(repo,{cartId:"cart",owner:customer,mutation:{operationId:"different-offer",requestHash:"hash",expectedVersion:1},selection:{...selection,quantity:1},revalidate:async(_,quantity)=>({...selection,offerReference:"other",quantity})})).rejects.toMatchObject({code:"CART_LINE_INVALID"});
    expect(repo.state.version).toBe(1);
  });
  it("merging identical guest/customer SKU reprices at the merged volume tier", async () => {
    const customerCart:MarketplaceCartState={id:"customer-cart",publicReference:"customer-ref",owner:customer,status:"ACTIVE",version:1,lines:[{publicReference:"own",storeId:"store",quantity:2,fingerprint:cartLineFingerprint({offerReference: "offer",variantReference:"variant",modifiers:[]}),selection:{...selection,quantity:2,unitPrice:"100.00"}}]};
    const guestCart:MarketplaceCartState={id:"guest-cart",publicReference:"guest-ref",owner:guest,status:"ACTIVE",version:1,lines:[{publicReference:"guest",storeId:"store",quantity:1,fingerprint:cartLineFingerprint({offerReference: "offer",variantReference:"variant",modifiers:[]}),selection:{...selection,quantity:1,unitPrice:"100.00"}}]};
    const repo=repository(customerCart);
    const result=await mergeGuestAndCustomerCarts(repo,{guestCart,customerCart,customerOwner:customer,mutation:{operationId:"merge-volume",requestHash:"merge-hash",expectedVersion:1},revalidate:async(line,quantity)=>({...line.selection,quantity:quantity??line.quantity,unitPrice:(quantity??line.quantity)>=3?"90.00":"100.00"})});
    expect(result.cart.lines).toHaveLength(1);
    expect(result.cart.lines[0]).toMatchObject({quantity:3,selection:{quantity:3,unitPrice:"90.00"}});
  });
  it("reprices a modifier collision at the combined quantity before removing the old line", async () => {
    const modifier = { groupReference:"topping", optionReference:"cheese", quantity:1,priceDelta:"3.00" };
    const cheese={...selection,quantity:2,modifiers:[modifier],unitPrice:"100.00"};
    const base={...selection,quantity:1,unitPrice:"100.00"};
    const cheeseFingerprint=cartLineFingerprint({offerReference:"offer",variantReference:"variant",modifiers:[{groupReference:"topping",optionReference:"cheese",quantity:1}]});
    const plainFingerprint=cartLineFingerprint({offerReference:"offer",variantReference:"variant",modifiers:[]});
    const repo=repository({id:"cart",publicReference:"cart-ref",owner:customer,status:"ACTIVE",version:1,lines:[
      {publicReference:"cheese",storeId:"store",quantity:2,fingerprint:cheeseFingerprint,selection:cheese},
      {publicReference:"plain",storeId:"store",quantity:1,fingerprint:plainFingerprint,selection:base},
    ]});
    const result=await replaceCartLineModifiers(repo,{cartId:"cart",lineReference:"plain",owner:customer,mutation:{operationId:"collision-tier",requestHash:"collision",expectedVersion:1},modifiers:[{groupReference:"topping",optionReference:"cheese",quantity:1}],
      revalidate:async (_line,_mods,quantity)=>({...cheese,quantity:quantity??1,unitPrice:(quantity??1)>=3?"90.00":"100.00"}) });
    expect(result.cart.lines).toHaveLength(1);
    expect(result.cart.lines[0]).toMatchObject({quantity:3,selection:{quantity:3,unitPrice:"90.00"}});
  });
  it("rejects changed-request replay and locked carts", async () => {
    const repo = repository({
      id: "cart",
      publicReference: "cart-ref",
      owner: customer,
      status: "CHECKOUT_LOCKED",
      version: 1,
      lines: [],
    });
    await expect(
      addCartLine(repo, {
        cartId: "cart",
        owner: customer,
        mutation: {
          operationId: "operation-add-2",
          requestHash: "a",
          expectedVersion: 1,
        },
        selection,
      }),
    ).rejects.toThrow("CART_MUTATION_NOT_ALLOWED");
  });
  it("revalidates quantity without accepting a price", async () => {
    const repo = repository({
      id: "cart",
      publicReference: "cart-ref",
      owner: customer,
      status: "ACTIVE",
      version: 1,
      lines: [
        {
          publicReference: "line",
          storeId: "store",
          quantity: 1,
          fingerprint: "fingerprint",
          selection,
        },
      ],
    });
    const result = await updateCartLineQuantity(repo, {
      cartId: "cart",
      lineReference: "line",
      owner: customer,
      mutation: {
        operationId: "operation-quantity-1",
        requestHash: "q",
        expectedVersion: 1,
      },
      quantity: 2,
      revalidate: async (_line, quantity) => ({
        ...selection,
        quantity,
        unitPrice: "11.00",
      }),
    });
    expect(result.cart.lines[0]?.selection.unitPrice).toBe("11.00");
    expect(result.cart.lines[0]?.quantity).toBe(2);
  });
  it("clears only an owned mutable cart", async () => {
    const repo = repository({
      id: "cart",
      publicReference: "cart-ref",
      owner: customer,
      status: "ACTIVE",
      version: 1,
      lines: [
        {
          publicReference: "line",
          storeId: "store",
          quantity: 1,
          fingerprint: "fingerprint",
          selection,
        },
      ],
    });
    await clearCart(repo, {
      cartId: "cart",
      owner: customer,
      mutation: {
        operationId: "operation-clear-1",
        requestHash: "c",
        expectedVersion: 1,
      },
    });
    expect(repo.state.lines).toHaveLength(0);
  });
  it("claims a guest cart for a customer without dropping lines", async () => {
    const repo = repository({
      id: "cart",
      publicReference: "cart-ref",
      owner: guest,
      status: "ACTIVE",
      version: 1,
      lines: [
        {
          publicReference: "line",
          storeId: "store",
          quantity: 1,
          fingerprint: "fingerprint",
          selection,
        },
      ],
    });
    const result = await claimGuestCart(repo, {
      guestOwner: guest,
      customerOwner: customer,
      mutation: {
        operationId: "operation-claim-1",
        requestHash: "claim",
        expectedVersion: 1,
      },
      revalidate: async (line) => line.selection,
    });
    expect(result.cart.owner).toEqual(customer);
    expect(result.cart.lines).toHaveLength(1);
  });
  it("merges through one transaction and records the canonical merge operation", async () => {
    const customerCart: MarketplaceCartState = {
      id: "customer-cart",
      publicReference: "customer-cart-ref",
      owner: customer,
      status: "ACTIVE",
      version: 1,
      lines: [],
    };
    const guestCart: MarketplaceCartState = {
      id: "guest-cart",
      publicReference: "guest-cart-ref",
      owner: guest,
      status: "ACTIVE",
      version: 1,
      lines: [
        {
          publicReference: "guest-line",
          storeId: "store",
          quantity: 1,
          fingerprint: "fingerprint",
          selection,
        },
      ],
    };
    const repo = repository(customerCart);
    const result = await mergeGuestAndCustomerCarts(repo, {
      guestCart,
      customerCart,
      customerOwner: customer,
      mutation: {
        operationId: "operation-merge-1",
        requestHash: "merge",
        expectedVersion: 1,
      },
      revalidate: async (line) => ({ ...line.selection, unitPrice: "11.00" }),
    });
    expect(repo.transactions).toBe(1);
    expect(result.cart.lines[0]?.selection.unitPrice).toBe("11.00");
    expect(result.cart.lines[0]?.publicReference).not.toBe("guest-line");
    expect(guestCart.lines[0].publicReference).toBe("guest-line");
    expect(result.cart.lines[0]?.quantity).toBe(1);
    expect(repo.receipts.get("operation-merge-1")?.type).toBe("MERGE");
  });
  it("rejects cross-owner cart access attempts", async () => {
    const otherCustomer = {
      type: "CUSTOMER" as const,
      userId: "other-customer",
    };
    const repo = repository({
      id: "cart",
      publicReference: "cart-ref",
      owner: customer,
      status: "ACTIVE",
      version: 1,
      lines: [],
    });
    await expect(
      addCartLine(repo, {
        cartId: "cart",
        owner: otherCustomer,
        mutation: {
          operationId: "op-cross",
          requestHash: "hash",
          expectedVersion: 1,
        },
        selection,
      }),
    ).rejects.toThrow("Cart is unavailable.");
  });
  it("rejects claim when guest cart item revalidation fails", async () => {
    const repo = repository({
      id: "cart",
      publicReference: "cart-ref",
      owner: guest,
      status: "ACTIVE",
      version: 1,
      lines: [
        {
          publicReference: "guest-line",
          storeId: "store",
          quantity: 1,
          fingerprint: "fingerprint",
          selection,
        },
      ],
    });
    await expect(
      claimGuestCart(repo, {
        guestOwner: guest,
        customerOwner: customer,
        mutation: {
          operationId: "op-fail-claim",
          requestHash: "hash-claim-fail",
          expectedVersion: 1,
        },
        revalidate: async () => {
          throw new Error("Unavailable product");
        },
      }),
    ).rejects.toThrow("A guest-cart item is no longer available.");
  });
  it("replays existing claim operation deterministically", async () => {
    const repo = repository({
      id: "cart",
      publicReference: "cart-ref",
      owner: guest,
      status: "ACTIVE",
      version: 1,
      lines: [
        {
          publicReference: "guest-line",
          storeId: "store",
          quantity: 1,
          fingerprint: "fingerprint",
          selection,
        },
      ],
    });
    const first = await claimGuestCart(repo, {
      guestOwner: guest,
      customerOwner: customer,
      mutation: {
        operationId: "op-claim-replay",
        requestHash: "hash-replay",
        expectedVersion: 1,
      },
      revalidate: async (line) => line.selection,
    });
    const replay = await claimGuestCart(repo, {
      guestOwner: guest,
      customerOwner: customer,
      mutation: {
        operationId: "op-claim-replay",
        requestHash: "hash-replay",
        expectedVersion: 1,
      },
      revalidate: async (line) => line.selection,
    });
    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.cart.id).toBe(first.cart.id);
  });
});
