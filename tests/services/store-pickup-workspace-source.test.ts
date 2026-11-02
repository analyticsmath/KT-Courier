import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ access: vi.fn(), findUnique: vi.fn() }));
vi.mock("@/lib/client-platform/store-access", () => ({ storeAccess: mocks.access }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { store: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/services/customer-addresses.service", () => ({ toSavedAddressDto: (address: unknown) => address }));
import { getStorePickupAddress } from "@/lib/services/store-addresses.service";

const pickup = {
  id: "saved-1", storeId: "store-1", type: "PICKUP", line1: "120 Market Street",
  line2: "Sandton", city: "Johannesburg", province: "Gauteng", country: "South Africa",
  postalCode: "2196", latitude: -26.1, longitude: 28.05, isDefault: false,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.access.mockResolvedValue({ store: { id: "store-1" } });
});

describe("vendor pickup source matches marketplace checkout pickup selection", () => {
  it("presents a valid saved pickup when an old default reference is missing", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "store-1", defaultPickupAddress: null, savedAddresses: [pickup],
    });
    const result = await getStorePickupAddress("merchant-1");
    expect(result?.pickupAddress).toEqual(pickup);
    expect(mocks.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "store-1" }, include: expect.objectContaining({
        defaultPickupAddress: true,
        savedAddresses: { where: { type: "PICKUP" }, orderBy: { createdAt: "asc" } },
      }),
    }));
  });

  it("falls back to a complete saved pickup when the default is incomplete", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "store-1", defaultPickupAddress: { ...pickup, id: "broken", city: "" },
      savedAddresses: [pickup],
    });
    expect((await getStorePickupAddress("merchant-1"))?.pickupAddress).toEqual(pickup);
  });

  it("never presents a third-party pickup or an imported business address", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "store-1", defaultPickupAddress: null,
      savedAddresses: [{ ...pickup, storeId: "store-2" }, { ...pickup, type: "BUSINESS" }],
    });
    expect((await getStorePickupAddress("merchant-1"))?.pickupAddress).toBeNull();
  });

  it("preserves a valid store-owned explicit default as the first choice", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "store-1", defaultPickupAddress: { ...pickup, id: "configured" },
      savedAddresses: [pickup],
    });
    expect((await getStorePickupAddress("merchant-1"))?.pickupAddress).toEqual({ ...pickup, id: "configured" });
  });

  it("returns an owned incomplete pickup for seller remediation when no complete pickup exists", async () => {
    const incomplete = { ...pickup, id: "incomplete", line2: null, postalCode: null, latitude: null, longitude: null };
    mocks.findUnique.mockResolvedValue({ id: "store-1", defaultPickupAddress: incomplete, savedAddresses: [incomplete] });
    expect((await getStorePickupAddress("merchant-1"))?.pickupAddress).toEqual(incomplete);
  });
});
