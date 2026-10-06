import { describe, expect, it } from "vitest";
import { SavedAddressCreateSchema, SavedAddressUpdateSchema, StorePickupAddressSchema } from "@/lib/validation/address-book";
const body = { line1: "12 Main Road" };
describe("saved address coordinate clearing", () => {
  it("accepts explicit paired null for customer and store text-only edits", () => {
    for (const schema of [SavedAddressCreateSchema, SavedAddressUpdateSchema, StorePickupAddressSchema]) expect(schema.parse({ ...body, placeId: null, latitude: null, longitude: null })).toMatchObject({ placeId: null, latitude: null, longitude: null });
  });
  it("rejects partial clearing and mixed numeric/null coordinate pairs", () => {
    for (const schema of [SavedAddressCreateSchema, SavedAddressUpdateSchema, StorePickupAddressSchema]) for (const coordinates of [{ latitude: null }, { longitude: null }, { latitude: -26.2, longitude: null }, { latitude: null, longitude: 28.04 }]) expect(schema.safeParse({ ...body, ...coordinates }).success).toBe(false);
  });
  it("preserves finite coordinate bounds and permits metadata-only updates", () => {
    for (const latitude of [91, -91, NaN, Infinity]) expect(SavedAddressUpdateSchema.safeParse({ latitude, longitude: 28 }).success).toBe(false);
    expect(SavedAddressUpdateSchema.parse({ isDefault: true })).toEqual({ isDefault: true });
  });
  it("allows optional saved-address details to be explicitly removed", () => {
    const empty = { contactName: null, contactPhone: null, line2: null, city: null, province: null, postalCode: null, accessNotes: null, formattedAddress: null };
    for (const schema of [SavedAddressCreateSchema, SavedAddressUpdateSchema, StorePickupAddressSchema]) expect(schema.parse({ ...body, ...empty })).toMatchObject(empty);
    expect(SavedAddressUpdateSchema.parse({ label: null })).toEqual({ label: null });
  });
});
