import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/logger", () => ({ logApplicationEvent: vi.fn() }));
import { logApplicationEvent } from "@/lib/observability/logger";
import { geocodeSouthAfricanAddress } from "@/lib/maps/geocode.service";

const config = {
  serverKey: "sensitive-test-server-key",
  geocodeApiUrl: "https://maps.googleapis.com/maps/api/geocode/json",
  regionBias: "za",
  routesApiUrl: "https://routes.googleapis.com/directions/v2:computeRoutes",
};
const address = {
  line1: "123 Private Street", city: "Midrand", province: "Gauteng",
};

beforeEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });
describe("safe geocoding production diagnostics", () => {
  it("records a diagnostic category when Google rejects server credentials without exposing address or key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      status: "REQUEST_DENIED", error_message: "The API key is not authorized.",
    }), { status: 200 }));
    expect(await geocodeSouthAfricanAddress(address, config)).toBeNull();
    expect(logApplicationEvent).toHaveBeenCalledWith(expect.objectContaining({
      event: "courier.geocode_rejected",
      errorCategory: "GEOCODE_PROVIDER_REJECTED",
    }));
    const raw = JSON.stringify(vi.mocked(logApplicationEvent).mock.calls);
    expect(raw).not.toContain(address.line1);
    expect(raw).not.toContain(config.serverKey);
  });
  it("reports rejected provider HTTP failures without logging provider secrets", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("permission denied", { status: 403 }));
    expect(await geocodeSouthAfricanAddress(address, config)).toBeNull();
    expect(logApplicationEvent).toHaveBeenCalledWith(expect.objectContaining({
      errorCategory: "GEOCODE_PROVIDER_HTTP_REJECTED",
    }));
    expect(JSON.stringify(vi.mocked(logApplicationEvent).mock.calls)).not.toContain("permission denied");
  });
});
