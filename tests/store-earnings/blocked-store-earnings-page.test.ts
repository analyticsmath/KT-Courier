import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StoreEarningError } from "@/lib/store-earnings/errors";

const mocks = vi.hoisted(() => ({ summary: vi.fn(), list: vi.fn(), detail: vi.fn() }));
vi.mock("@/lib/client-platform/business-auth", () => ({ requireBusinessPage: async () => null }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: async () => ({ id: "inactive-store-owner", role: "STORE" }) }));
vi.mock("@/lib/services/store-earning-summary.service", () => ({ getStoreEarningSummaryForOwner: mocks.summary }));
vi.mock("@/lib/services/store-earning-query.service", () => ({ listStoreEarningsForOwner: mocks.list, getStoreEarningForOwner: mocks.detail }));
import StoreEarningsPage from "@/app/(store)/store/earnings/page";
import StoreEarningDetailPage from "@/app/(store)/store/earnings/[publicReference]/page";

describe("inactive store finance page access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const blocked = new StoreEarningError("STORE_EARNING_FORBIDDEN", "An active business is required.");
    mocks.summary.mockRejectedValue(blocked);
    mocks.list.mockRejectedValue(blocked);
    mocks.detail.mockRejectedValue(blocked);
  });

  it("explains why the earnings overview is locked without exposing numbers or crashing", async () => {
    const html = renderToStaticMarkup(await StoreEarningsPage());
    expect(html).toMatch(/Earnings unavailable|Business approval required/i);
    expect(html).not.toMatch(/Payable balance|Available payable|ZAR 0\.00/i);
  });

  it("does not disguise database failures as a routine access restriction", async () => {
    mocks.summary.mockRejectedValue(new Error("database unavailable"));
    await expect(StoreEarningsPage()).rejects.toThrow("database unavailable");
  });

  it("does not reveal historical earnings for an inactive store when visiting a detail URL", async () => {
    const html = renderToStaticMarkup(await StoreEarningDetailPage({ params: Promise.resolve({ publicReference: "private-earning" }) }));
    expect(html).toMatch(/Earnings unavailable|Business approval required/i);
    expect(html).not.toContain("private-earning");
  });
});
