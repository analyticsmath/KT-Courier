import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createCustomerAddress, getCustomerAddress, updateCustomerAddress } from "@/lib/services/customer-addresses.service";
import { getStorePickupAddress, upsertStorePickupAddress } from "@/lib/services/store-addresses.service";
import { SavedAddressCreateSchema, SavedAddressUpdateSchema, StorePickupAddressSchema } from "@/lib/validation/address-book";

const database = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
const enabled = process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS === "1" && database.hostname === "127.0.0.1" && database.pathname === "/kt_launch_test";
async function user(role: "CUSTOMER" | "STORE" = "CUSTOMER") { return prisma.user.create({ data: { email: `address-${randomUUID()}@example.test`, role, status: "ACTIVE" } }); }
const pin = { line1: "12 Main Road", country: "South Africa", latitude: -26.2134567, longitude: 28.0523456, placeId: "selected-place", formattedAddress: "12 Main Road, Johannesburg, South Africa" };

describe.skipIf(!enabled)("dashboard address persistence in isolated PostgreSQL", () => {
  it("saves and reloads the exact dropoff point with seven-decimal precision", async () => {
    const owner = await user(); const saved = await createCustomerAddress(owner.id, SavedAddressCreateSchema.parse({ ...pin, type: "DROPOFF" }));
    expect(saved).toMatchObject({ type: "DROPOFF", latitude: pin.latitude, longitude: pin.longitude, placeId: pin.placeId });
    expect(await getCustomerAddress(owner.id, saved.id)).toMatchObject({ latitude: pin.latitude, longitude: pin.longitude });
  });
  it("explicitly clears both old coordinates and place authority on text-only editing", async () => {
    const owner = await user(); const saved = await createCustomerAddress(owner.id, SavedAddressCreateSchema.parse({ ...pin, type: "PICKUP" }));
    const updated = await updateCustomerAddress(owner.id, saved.id, SavedAddressUpdateSchema.parse({ line1: "24 New Road", placeId: null, latitude: null, longitude: null }));
    expect(updated).toMatchObject({ line1: "24 New Road", latitude: null, longitude: null, placeId: null });
    expect(await getCustomerAddress(owner.id, saved.id)).toMatchObject({ latitude: null, longitude: null });
  });
  it("preserves a pin when only default/contact metadata changes", async () => {
    const owner = await user(); const saved = await createCustomerAddress(owner.id, SavedAddressCreateSchema.parse(pin));
    const updated = await updateCustomerAddress(owner.id, saved.id, SavedAddressUpdateSchema.parse({ isDefault: true }));
    expect(updated).toMatchObject({ latitude: pin.latitude, longitude: pin.longitude, placeId: pin.placeId, isDefault: true });
  });
  it("clears stale authority for older API clients editing street text without coordinate fields", async () => {
    const owner = await user(); const saved = await createCustomerAddress(owner.id, SavedAddressCreateSchema.parse(pin));
    expect(await updateCustomerAddress(owner.id, saved.id, SavedAddressUpdateSchema.parse({ line1: "40 Different Street" }))).toMatchObject({ latitude: null, longitude: null, placeId: null });
  });
  it("cannot read or mutate another customer's pin", async () => {
    const owner = await user(), outsider = await user(); const saved = await createCustomerAddress(owner.id, SavedAddressCreateSchema.parse(pin));
    expect(await getCustomerAddress(outsider.id, saved.id)).toBeNull(); expect(await updateCustomerAddress(outsider.id, saved.id, SavedAddressUpdateSchema.parse({ latitude: -26.5, longitude: 28.5 }))).toBeNull(); expect(await getCustomerAddress(owner.id, saved.id)).toMatchObject({ latitude: pin.latitude, longitude: pin.longitude });
  });
  it("persists the store pickup point and clears it when changed to an unmapped address", async () => {
    const owner = await user("STORE"); await prisma.store.create({ data: { ownerUserId: owner.id, name: "Isolated pin store", slug: `pin-store-${randomUUID()}`, status: "ACTIVE" } });
    const saved = await upsertStorePickupAddress(owner.id, StorePickupAddressSchema.parse(pin));
    expect(saved).toMatchObject({ latitude: pin.latitude, longitude: pin.longitude });
    expect((await getStorePickupAddress(owner.id))?.pickupAddress).toMatchObject({ id: saved!.id, latitude: pin.latitude });
    const updated = await upsertStorePickupAddress(owner.id, StorePickupAddressSchema.parse({ line1: "New manual pickup", latitude: null, longitude: null, placeId: null }));
    expect(updated).toMatchObject({ id: saved!.id, latitude: null, longitude: null, placeId: null });
  });
});
