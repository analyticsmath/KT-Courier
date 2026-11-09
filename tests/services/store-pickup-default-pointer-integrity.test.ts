import { beforeEach, describe, expect, it, vi } from "vitest";
import { StorePickupAddressSchema } from "@/lib/validation/address-book";

const mock = vi.hoisted(() => ({
  access: vi.fn(), transaction: vi.fn(), lock: vi.fn(), current: vi.fn(),
  clearDefault: vi.fn(), lookup: vi.fn(), updateAddress: vi.fn(), createAddress: vi.fn(),
  updateStore: vi.fn(), revoke: vi.fn(), activity: vi.fn(), rebuild: vi.fn(),
}));
vi.mock("@/lib/client-platform/store-access", () => ({ storeAccess: mock.access }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mock.transaction } }));
vi.mock("@/lib/services/storefront-store.service", () => ({ rebuildStorefrontStoreDocument: mock.rebuild }));
vi.mock("@/lib/services/customer-addresses.service", () => ({ toSavedAddressDto: (value: unknown) => value }));
import { upsertStorePickupAddress } from "@/lib/services/store-addresses.service";

const input = StorePickupAddressSchema.parse({
  line1: "12 Main Road", line2: "Sandton", city: "Johannesburg", province: "Gauteng",
  postalCode: "2196", country: "South Africa", latitude: -26.12, longitude: 28.05, placeId: "real-map-pin-123",
});
const previous = {
  id: "address-old", storeId: "store-own", type: "PICKUP",
  line1: "12 Main Road", line2: "Sandton", city: "Johannesburg", province: "Gauteng",
  postalCode: "2196", country: "South Africa", latitude: -26.12, longitude: 28.05, placeId: "real-map-pin-123",
};
const transaction = {
  $queryRaw: mock.lock,
  store: { findUniqueOrThrow: mock.current, update: mock.updateStore },
  address: { updateMany: mock.clearDefault, findFirst: mock.lookup, update: mock.updateAddress, create: mock.createAddress },
  storeCheckoutCertification: { updateMany: mock.revoke },
  adminActivityLog: { create: mock.activity },
};

beforeEach(() => {
  vi.resetAllMocks();
  mock.access.mockResolvedValue({ store: { id: "store-own" } });
  mock.transaction.mockImplementation((fn: (tx: typeof transaction) => Promise<unknown>) => fn(transaction));
  mock.clearDefault.mockResolvedValue({ count: 1 });
  mock.createAddress.mockResolvedValue({ ...previous, id: "address-new" });
  mock.updateAddress.mockResolvedValue(previous);
  mock.updateStore.mockResolvedValue({});
  mock.activity.mockResolvedValue({});
  mock.revoke.mockResolvedValue({ count: 0 });
});

describe("store pickup pointer integrity", () => {
  it("preserves an old BUSINESS address when a stale default points at it", async () => {
    mock.current.mockResolvedValue({
      id: "store-own", status: "PENDING",
      defaultPickupAddressId: "address-old",
      defaultPickupAddress: { ...previous, type: "BUSINESS" },
    });
    mock.lookup.mockResolvedValue({ ...previous, type: "BUSINESS" });
    const saved = await upsertStorePickupAddress("merchant", input);
    expect(saved).toMatchObject({ id: "address-new", type: "PICKUP" });
    expect(mock.createAddress).toHaveBeenCalledTimes(1);
    expect(mock.updateAddress).not.toHaveBeenCalled();
    expect(mock.updateStore).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ defaultPickupAddressId: "address-new" }),
    }));
  });

  it("updates the existing owned default pickup without duplicating it", async () => {
    mock.current.mockResolvedValue({ id: "store-own", status: "PENDING",
      defaultPickupAddressId: "address-old", defaultPickupAddress: previous });
    mock.lookup.mockResolvedValue(previous);
    const saved = await upsertStorePickupAddress("merchant", input);
    expect(saved).toMatchObject({ id: "address-old", type: "PICKUP" });
    expect(mock.updateAddress).toHaveBeenCalledTimes(1);
    expect(mock.createAddress).not.toHaveBeenCalled();
  });

  it("never updates a default address that belongs to another store", async () => {
    mock.current.mockResolvedValue({ id: "store-own", status: "PENDING",
      defaultPickupAddressId: "address-old", defaultPickupAddress: { ...previous, storeId: "other-store" } });
    mock.lookup.mockResolvedValue({ ...previous, storeId: "other-store" });
    const saved = await upsertStorePickupAddress("merchant", input);
    expect(saved).toMatchObject({ id: "address-new", type: "PICKUP" });
    expect(mock.updateAddress).not.toHaveBeenCalled();
    expect(mock.createAddress).toHaveBeenCalledTimes(1);
  });
});
