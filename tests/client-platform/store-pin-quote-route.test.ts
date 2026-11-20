import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ user: vi.fn(), access: vi.fn(), quote: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/client-platform/store-access", () => ({ storeAccess: mocks.access }));
vi.mock("@/lib/client-platform/delivery.service", () => ({ createPublicQuote: mocks.quote, deliveryCatalog: vi.fn() }));
vi.mock("@/lib/client-platform/api", async (original) => ({
  ...await original<typeof import("@/lib/client-platform/api")>(),
  mutation: async (request: NextRequest) => ({ body: await request.json() }),
}));
import { POST } from "@/app/api/public/delivery-quotes/route";

const pickup = { line1: "12 Oxford Road", city: "Johannesburg", province: "Gauteng", latitude: -26.145, longitude: 28.044 };
const payload = { serviceKey: "CLIENT_ECONOMY", parcelSize: "MEDIUM", weightKg: "15.0000", pickupAddress: pickup, dropoffAddress: { line1: "1 Main Road", city: "Krugersdorp", province: "Gauteng" } };
function request(headers: Record<string, string> = {}) {
  return new NextRequest("https://example.test/api/public/delivery-quotes", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(payload) });
}
beforeEach(() => { vi.resetAllMocks(); mocks.quote.mockResolvedValue({ id: "quote-test" }); });
describe("store pickup without a Place ID", () => {
  it("accepts the pin only after authorizing the selected store", async () => {
    mocks.user.mockResolvedValue({ id: "employee", status: "ACTIVE", role: "CUSTOMER" });
    mocks.access.mockResolvedValue({ store: { id: "store-b" } });
    const response = await POST(request({ "X-KT-Workspace": "STORE", "X-KT-Store-Id": "store-b" }));
    expect(response.status).toBe(201);
    expect(mocks.access).toHaveBeenCalledWith("employee", "deliveries", "store-b");
    expect(mocks.quote).toHaveBeenCalledWith(expect.objectContaining({ pickupAddress: pickup }), { ownerType: "STORE", ownerId: "store-b" });
  });
  it("does not let a guest select the more permissive store schema with headers", async () => {
    mocks.user.mockResolvedValue(null);
    const response = await POST(request({ "X-KT-Workspace": "STORE", "X-KT-Store-Id": "store-b" }));
    expect(response.status).toBe(422);
    expect(mocks.access).not.toHaveBeenCalled();
    expect(mocks.quote).not.toHaveBeenCalled();
  });
});
