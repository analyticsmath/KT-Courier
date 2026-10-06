import { describe, expect, it } from "vitest";
import { StoreSignupSchema } from "@/lib/validation/auth";
const input = { accountType: "STORE", storeName: "Real vendor", contactPerson: "Owner Name", email: "owner@example.test", phone: "0820000000", password: "SecurePassword1!", confirmPassword: "SecurePassword1!" };
describe("store registration pickup address", () => {
  it("retains complete mapped coordinates while allowing existing text-only registration", () => {
    expect(StoreSignupSchema.safeParse(input).success).toBe(true);
    const parsed = StoreSignupSchema.parse({ ...input, businessLocation: { line1: "1 Main Road", city: "Johannesburg", country: "South Africa", latitude: -26.2, longitude: 28.04 } });
    expect(parsed.businessLocation).toMatchObject({ latitude: -26.2, longitude: 28.04 });
  });
  it("rejects unpaired and invalid coordinates instead of inventing a missing location", () => {
    expect(StoreSignupSchema.safeParse({ ...input, businessLocation: { line1: "1 Main Road", latitude: -26.2 } }).success).toBe(false);
    expect(StoreSignupSchema.safeParse({ ...input, businessLocation: { line1: "1 Main Road", latitude: 200, longitude: 28 } }).success).toBe(false);
  });
});
