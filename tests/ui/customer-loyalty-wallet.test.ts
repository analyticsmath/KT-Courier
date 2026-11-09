// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), fetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { CustomerLoyaltyWalletPanel } from "@/components/customer/CustomerLoyaltyWalletPanel";

const summary = (overrides: Record<string, unknown> = {}) => ({
  availablePoints: "275",
  debtPoints: "0",
  lifetimeEarnedPoints: "400",
  conversion: { enabled: false, pointsRequired: 100, walletRand: "2.00" },
  redemptions: [],
  ...overrides,
});
const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });

describe("customer wallet loyalty conversion UX", () => {
  let root: Root;
  let host: HTMLDivElement;
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("crypto", { randomUUID: () => "test-operation-uuid-1234" });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  async function render() {
    await act(async () => root.render(createElement(CustomerLoyaltyWalletPanel)));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  }

  it("shows verified balance and disables redemption until the administrator enables it", async () => {
    mocks.fetch.mockResolvedValue(json(summary()));
    vi.stubGlobal("fetch", mocks.fetch);
    await render();
    expect(host.textContent).toContain("275");
    expect(host.textContent).toContain("Conversions are not currently available");
    expect(host.querySelector<HTMLButtonElement>('button[aria-describedby="loyalty-conversion-policy"]')?.disabled).toBe(true);
    expect(mocks.fetch).toHaveBeenCalledWith("/api/account/loyalty", expect.objectContaining({ cache: "no-store" }));
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("posts one exact conversion block, displays a success receipt and refreshes wallet", async () => {
    mocks.fetch
      .mockResolvedValueOnce(json(summary({ conversion: { enabled: true, pointsRequired: 100, walletRand: "2.00" } })))
      .mockResolvedValueOnce(json({ journalId: "journal-1", status: "REDEEMED", pointsRedeemed: "100", walletCreditZar: "2.00" }))
      .mockResolvedValueOnce(json(summary({
        availablePoints: "175", conversion: { enabled: true, pointsRequired: 100, walletRand: "2.00" },
        redemptions: [{ reference: "receipt-1", pointsRedeemed: "100", walletCreditZar: "2.00", occurredAt: "2026-11-08T00:00:00Z" }],
      })));
    vi.stubGlobal("fetch", mocks.fetch);
    await render();
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-describedby="loyalty-conversion-policy"]')?.click());
    const postCall = mocks.fetch.mock.calls.find(call => call[0] === "/api/account/loyalty/redeem");
    expect(postCall).toBeTruthy();
    expect(postCall![1]).toMatchObject({
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(postCall![1].body)).toEqual({ operationId: "test-operation-uuid-1234", points: "100" });
    expect(host.textContent).toContain("100 points were converted into R2.00 wallet credit");
    expect(host.textContent).toContain("175");
    expect(host.textContent).toContain("Recent conversions");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not attempt conversion for missing, insufficient or reversed reward points", async () => {
    mocks.fetch.mockResolvedValue(json(summary({
      debtPoints: "9", conversion: { enabled: true, pointsRequired: 100, walletRand: "2.00" },
    })));
    vi.stubGlobal("fetch", mocks.fetch);
    await render();
    expect(host.textContent).toContain("Reversed rewards awaiting recovery");
    expect(host.querySelector<HTMLButtonElement>('button[aria-describedby="loyalty-conversion-policy"]')?.disabled).toBe(true);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("uses the same idempotency receipt when a network error makes the result uncertain", async () => {
    const active = summary({ conversion: { enabled: true, pointsRequired: 100, walletRand: "2.00" } });
    mocks.fetch
      .mockResolvedValueOnce(json(active))
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValueOnce(json({ journalId: "journal-1", status: "REPLAYED", pointsRedeemed: "100", walletCreditZar: "2.00" }))
      .mockResolvedValueOnce(json(summary({ availablePoints: "175", conversion: active.conversion })));
    vi.stubGlobal("fetch", mocks.fetch);
    await render();
    const redeemButton = () => host.querySelector<HTMLButtonElement>('button[aria-describedby="loyalty-conversion-policy"]')!;
    await act(async () => redeemButton().click());
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Connection lost");
    await act(async () => redeemButton().click());
    const posts = mocks.fetch.mock.calls.filter(call => call[0] === "/api/account/loyalty/redeem");
    expect(posts).toHaveLength(2);
    expect(JSON.parse(posts[0][1].body).operationId).toBe(JSON.parse(posts[1][1].body).operationId);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
});
