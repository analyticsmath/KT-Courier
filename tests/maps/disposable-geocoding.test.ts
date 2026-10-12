import { describe, expect, it } from "vitest";
import { disposableGeocode, southAfricanAddressQuery } from "@/lib/testing/disposable-geocoding";

const address = { line1: "45 Commission St", line2: " ", suburb: "Central", city: "Johannesburg", province: "Gauteng", postalCode: "2001" };
const query = southAfricanAddressQuery(address);
const coordinates = { latitude: -26.2041, longitude: 28.0473 };
const environment: NodeJS.ProcessEnv = {
  NODE_ENV: "test", KT_RUNTIME_ENV: "e2e", KT_NETWORK_DISABLED: "true", KT_LOCAL_CHECKOUT_VALIDATION: "true",
  DATABASE_URL: "postgresql://disposable:disposable_only@localhost:5432/kt_phase75_e2e",
  KT_E2E_GEOCODE_FIXTURES: JSON.stringify({ [query]: coordinates }),
};
const unsafeEnvironments: Partial<NodeJS.ProcessEnv>[] = [
  { KT_RUNTIME_ENV: "production", NODE_ENV: "production" },
  { KT_RUNTIME_ENV: "staging-demo" },
  { KT_NETWORK_DISABLED: "false" },
  { KT_LOCAL_CHECKOUT_VALIDATION: "false" },
  { DATABASE_URL: "postgresql://disposable:disposable_only@remote.invalid/kt_phase75_e2e" },
  { DATABASE_URL: "postgresql://disposable:disposable_only@localhost/production" },
  { DATABASE_URL: "postgresql://disposable:disposable_only@localhost/other_e2e" },
  { DATABASE_URL: "invalid" },
  { DATABASE_URL: undefined },
];

describe("isolated address geocoding fixtures", () => {
  it("selects the real provider when no fixture is configured", () => {
    expect(disposableGeocode(address, { NODE_ENV: "test" })).toBeUndefined();
  });
  it("resolves only an explicitly named address in the disposable browser database", () => {
    expect(disposableGeocode(address, environment)).toEqual(coordinates);
    expect(disposableGeocode({ ...address, line1: "Another address" }, environment)).toBeNull();
    expect(Object.isFrozen(disposableGeocode(address, environment))).toBe(true);
  });
  it.each(unsafeEnvironments)("rejects unsafe runtime or database configuration %#", (override) => {
    expect(disposableGeocode(address, { ...environment, ...override })).toBeNull();
  });
  it.each(["invalid JSON", "null", "[]", JSON.stringify({ [query]: { latitude: 91, longitude: 28 } }), JSON.stringify({ [query]: { latitude: -26, longitude: -181 } }), JSON.stringify({ [query]: { latitude: "-26", longitude: 28 } }), "x".repeat(8193)])("rejects malformed or invalid fixture coordinates %#", (serialized) => {
    expect(disposableGeocode(address, { ...environment, KT_E2E_GEOCODE_FIXTURES: serialized })).toBeNull();
  });
});
