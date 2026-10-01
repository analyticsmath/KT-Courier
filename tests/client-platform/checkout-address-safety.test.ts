import { beforeEach, describe, expect, it, vi } from "vitest";

const maps = vi.hoisted(() => ({ geocode: vi.fn(), coverage: vi.fn() }));
vi.mock("@/lib/maps/geocode.service", () => ({
  geocodeSouthAfricanAddress: maps.geocode,
}));
vi.mock("@/lib/maps/delivery-zone.service", () => ({
  checkDeliveryZone: maps.coverage,
}));
import {
  updateMarketplaceCheckoutAddress,
  updateMarketplaceCheckoutContact,
} from "@/lib/marketplace-checkout/checkout.service";

const input = {
  reference: "checkout-owned",
  owner: { type: "CUSTOMER" as const, userId: "customer" },
  operation: {
    operationId: "edit-address",
    requestHash: "address-hash",
    expectedVersion: 2,
  },
  address: {
    recipientName: "Customer",
    line1: "10 Main Road",
    city: "Johannesburg",
    province: "Gauteng",
    serviceAreaReference: "client-forged-region",
  },
};

function fixture(status = "CREATED") {
  const checkout = {
    id: "checkout-id",
    publicReference: input.reference,
    version: 2,
    status,
    storeGroups: [],
    changes: [],
  };
  const db = {
    marketplaceCheckout: {
      findFirst: vi.fn().mockResolvedValue(checkout),
      update: vi
        .fn()
        .mockResolvedValue({ ...checkout, version: 3, status: "VALIDATING" }),
    },
    marketplaceCheckoutAddressSnapshot: {
      create: vi.fn().mockResolvedValue({ id: "address-snapshot" }),
    },
    marketplaceCheckoutContactSnapshot: {
      create: vi.fn().mockResolvedValue({ id: "contact-snapshot" }),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ id: checkout.id }]),
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(
    async (work: (tx: typeof db) => Promise<unknown>) => work(db),
  );
  return db;
}

describe("checkout address safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maps.geocode.mockResolvedValue({ latitude: -26.2, longitude: 28.04 });
    maps.coverage.mockResolvedValue({
      matched: true,
      regionId: "active-server-region",
      withinMaxDistance: true,
    });
  });

  it.each([
    "RESERVING",
    "RESERVED",
    "PAYMENT_PREPARING",
    "PAYMENT_PENDING",
    "CANCELLED",
    "EXPIRED",
  ])("rejects %s before geocoding or creating evidence", async (status) => {
    const db = fixture(status);
    await expect(
      updateMarketplaceCheckoutAddress(input, db as never),
    ).rejects.toThrow("immutable at this stage");
    expect(maps.geocode).not.toHaveBeenCalled();
    expect(db.marketplaceCheckoutAddressSnapshot.create).not.toHaveBeenCalled();
  });

  it("rejects an unowned checkout before external lookup", async () => {
    const db = fixture();
    db.marketplaceCheckout.findFirst.mockResolvedValue(null as never);
    await expect(
      updateMarketplaceCheckoutAddress(input, db as never),
    ).rejects.toMatchObject({ code: "CHECKOUT_ACCESS_DENIED" });
    expect(maps.geocode).not.toHaveBeenCalled();
  });

  it("takes coverage from active server regions and commits snapshot and version together", async () => {
    const db = fixture();
    await expect(
      updateMarketplaceCheckoutAddress(input, db as never),
    ).resolves.toMatchObject({ version: 3 });
    expect(db.$queryRaw).toHaveBeenCalledOnce();
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(db.marketplaceCheckoutAddressSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        serviceAreaReference: "active-server-region",
        protectedCoordinates: { latitude: -26.2, longitude: 28.04 },
      }),
    });
    expect(db.marketplaceCheckout.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "checkout-id", version: 2 }),
        data: expect.objectContaining({ acceptedFingerprint: null }),
      }),
    );
  });

  it("rejects unavailable operational coverage without creating a snapshot", async () => {
    const db = fixture();
    maps.coverage.mockResolvedValue({
      matched: false,
      regionId: null,
      withinMaxDistance: null,
    });
    await expect(
      updateMarketplaceCheckoutAddress(input, db as never),
    ).rejects.toThrow("currently active service areas");
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.marketplaceCheckoutAddressSnapshot.create).not.toHaveBeenCalled();
  });

  it("rechecks payment state under the row lock after geocoding", async () => {
    const db = fixture();
    db.marketplaceCheckout.findFirst
      .mockResolvedValueOnce({
        id: "checkout-id",
        publicReference: input.reference,
        version: 2,
        status: "CREATED",
        storeGroups: [],
        changes: [],
      })
      .mockResolvedValue({
        id: "checkout-id",
        publicReference: input.reference,
        version: 2,
        status: "PAYMENT_PENDING",
        storeGroups: [],
        changes: [],
      });
    await expect(
      updateMarketplaceCheckoutAddress(input, db as never),
    ).rejects.toThrow("immutable at this stage");
    expect(db.$queryRaw).toHaveBeenCalledOnce();
    expect(db.marketplaceCheckoutAddressSnapshot.create).not.toHaveBeenCalled();
  });

  it("rechecks version before creating a contact snapshot", async () => {
    const db = fixture();
    db.marketplaceCheckout.findFirst
      .mockResolvedValueOnce({
        id: "checkout-id",
        publicReference: input.reference,
        version: 2,
        status: "CREATED",
        storeGroups: [],
        changes: [],
      })
      .mockResolvedValue({
        id: "checkout-id",
        publicReference: input.reference,
        version: 3,
        status: "CREATED",
        storeGroups: [],
        changes: [],
      });
    await expect(
      updateMarketplaceCheckoutContact(
        {
          ...input,
          contact: {
            recipientName: "Customer",
            email: "customer@example.com",
            phone: "+27821234567",
          },
        },
        db as never,
      ),
    ).rejects.toMatchObject({ code: "CHECKOUT_VERSION_CONFLICT" });
    expect(db.marketplaceCheckoutContactSnapshot.create).not.toHaveBeenCalled();
  });
});
