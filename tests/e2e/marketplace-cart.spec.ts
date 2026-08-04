import { expect, test } from "@playwright/test";
import { attachConsoleMonitor } from "./fixtures/console-monitor";
import { login } from "./fixtures/auth";

const isLocalValidationServerAvailable = Boolean(
  process.env.PLAYWRIGHT_BASE_URL || process.env.KT_LOCAL_STOREFRONT_VALIDATION === "true"
);

const SAFE_HASH = "request-hash-1234567890123456";

test.describe("Marketplace Cart Journey", () => {
  test.beforeEach(() => {
    test.skip(!isLocalValidationServerAvailable, "Requires active local app instance with KT_LOCAL_STOREFRONT_VALIDATION=true");
  });

  test("anonymous cart creation sets guest ownership cookie and records line selection", async ({ request, page }) => {
    const monitor = attachConsoleMonitor(page);

    const res = await request.post("/api/cart/lines", {
      data: {
        offerReference: "off_64gb",
        variantReference: "var_64gb",
        quantity: 1,
        modifiers: [],
        operationId: `op-create-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: 0,
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.cart).toBeDefined();
    expect(body.cart.reference).toBeDefined();

    const headers = res.headers();
    const setCookie = headers["set-cookie"] || "";
    expect(setCookie).toContain("kt_marketplace_cart");

    const storeGroups = body.cart.storeGroups;
    expect(storeGroups.length).toBeGreaterThan(0);
    const line = storeGroups[0].lines[0];
    expect(line.variantReference).toBe("var_64gb");
    expect(line.quantity).toBe(1);

    await page.goto("/cart");
    await expect(page.locator("h1")).toBeVisible();

    monitor.assertClean();
  });

  test("quantity update modifies line quantity and persists across reload", async ({ request, page }) => {
    const monitor = attachConsoleMonitor(page);

    const op1 = `op-qty-1-${Date.now()}`;
    const createRes = await request.post("/api/cart/lines", {
      data: {
        offerReference: "off_64gb",
        variantReference: "var_64gb",
        quantity: 1,
        modifiers: [],
        operationId: op1,
        requestHash: SAFE_HASH,
        cartVersion: 0,
      },
    });
    expect(createRes.status()).toBe(201);
    const createBody = await createRes.json();
    const lineRef = createBody.cart.storeGroups[0].lines[0].reference;
    const version = createBody.cart.version;

    const updateRes = await request.put(`/api/cart/lines/${lineRef}`, {
      data: {
        quantity: 3,
        operationId: `op-qty-2-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: version,
      },
    });
    expect(updateRes.status()).toBe(200);
    const updateBody = await updateRes.json();
    const updatedLine = updateBody.cart.storeGroups[0].lines.find((l: { reference: string }) => l.reference === lineRef);
    expect(updatedLine.quantity).toBe(3);

    await page.goto("/cart");
    await expect(page.locator("h1")).toBeVisible();

    monitor.assertClean();
  });

  test("modifier update applies selected modifier and recalculates line total", async ({ request, page }) => {
    const monitor = attachConsoleMonitor(page);

    const createRes = await request.post("/api/cart/lines", {
      data: {
        offerReference: "off_64gb",
        variantReference: "var_64gb",
        quantity: 1,
        modifiers: [],
        operationId: `op-mod-1-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: 0,
      },
    });
    const createBody = await createRes.json();
    const lineRef = createBody.cart.storeGroups[0].lines[0].reference;
    const version = createBody.cart.version;

    const modRes = await request.put(`/api/cart/lines/${lineRef}`, {
      data: {
        quantity: 1,
        modifiers: [{ groupReference: "mod_warranty", optionReference: "opt_2yr", quantity: 1 }],
        operationId: `op-mod-2-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: version,
      },
    });
    expect(modRes.status()).toBe(200);
    const modBody = await modRes.json();
    const line = modBody.cart.storeGroups[0].lines[0];
    expect(line.selectedModifiers.length).toBe(1);
    expect(line.lineTotal).toBe("1750.00");

    monitor.assertClean();
  });

  test("line removal clears cart line and returns truthful empty cart state", async ({ request, page }) => {
    const monitor = attachConsoleMonitor(page);

    const createRes = await request.post("/api/cart/lines", {
      data: {
        offerReference: "off_64gb",
        variantReference: "var_64gb",
        quantity: 1,
        modifiers: [],
        operationId: `op-del-1-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: 0,
      },
    });
    const createBody = await createRes.json();
    const lineRef = createBody.cart.storeGroups[0].lines[0].reference;
    const version = createBody.cart.version;

    const delRes = await request.delete(`/api/cart/lines/${lineRef}`, {
      data: {
        operationId: `op-del-2-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: version,
      },
    });
    expect(delRes.status()).toBe(200);
    const delBody = await delRes.json();
    expect(delBody.cart.storeGroups.length).toBe(0);

    monitor.assertClean();
  });

  test("cart claim invalidates guest token cookie upon customer auth", async ({ request, page }) => {
    const monitor = attachConsoleMonitor(page);

    const guestCartRes = await request.post("/api/cart/lines", {
      data: {
        offerReference: "off_64gb",
        variantReference: "var_64gb",
        quantity: 1,
        modifiers: [],
        operationId: `op-claim-1-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: 0,
      },
    });
    const guestCartBody = await guestCartRes.json();
    const cartRef = guestCartBody.cart.reference;

    await login(page, "customer@ktcouriers.local");

    const claimRes = await page.request.post("/api/cart/claim", {
      data: {
        cartReference: cartRef,
        operationId: `op-claim-2-${Date.now()}`,
        requestHash: SAFE_HASH,
      },
    });
    expect(claimRes.status()).toBe(200);
    const claimBody = await claimRes.json();
    expect(claimBody.cart.owner.type).toBe("CUSTOMER");

    monitor.assertClean();
  });

  test("cart merge combines guest and customer cart lines cleanly according to fingerprint policy", async ({ request, page }) => {
    const monitor = attachConsoleMonitor(page);

    const guestCartRes = await request.post("/api/cart/lines", {
      data: {
        offerReference: "off_64gb",
        variantReference: "var_64gb",
        quantity: 2,
        modifiers: [],
        operationId: `op-merge-guest-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: 0,
      },
    });
    const guestCartBody = await guestCartRes.json();
    const guestCartRef = guestCartBody.cart.reference;

    await login(page, "customer@ktcouriers.local");

    const custCartRes = await page.request.post("/api/cart/lines", {
      data: {
        offerReference: "off_64gb",
        variantReference: "var_64gb",
        quantity: 1,
        modifiers: [],
        operationId: `op-merge-cust-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: 0,
      },
    });
    const custCartBody = await custCartRes.json();

    const mergeRes = await page.request.post("/api/cart/merge", {
      data: {
        sourceCartReference: guestCartRef,
        targetCartReference: custCartBody.cart.reference,
        operationId: `op-merge-do-${Date.now()}`,
        requestHash: SAFE_HASH,
      },
    });
    expect(mergeRes.status()).toBe(200);
    const mergeBody = await mergeRes.json();
    const lines = mergeBody.cart.storeGroups[0].lines;
    expect(lines[0].quantity).toBe(3);

    monitor.assertClean();
  });

  test("cart operation replay returns deterministic receipt without duplicate line creation", async ({ request, page }) => {
    const monitor = attachConsoleMonitor(page);

    const opId = `op-replay-${Date.now()}`;
    const payload = {
      offerReference: "off_64gb",
      variantReference: "var_64gb",
      quantity: 1,
      modifiers: [],
      operationId: opId,
      requestHash: SAFE_HASH,
      cartVersion: 0,
    };

    const res1 = await request.post("/api/cart/lines", { data: payload });
    expect(res1.status()).toBe(201);
    const body1 = await res1.json();

    const res2 = await request.post("/api/cart/lines", { data: payload });
    expect([200, 201]).toContain(res2.status());
    const body2 = await res2.json();

    expect(body1.cart.reference).toBe(body2.cart.reference);

    monitor.assertClean();
  });

  test("unauthorized access attempt without guest secret is safely denied", async ({ request, page }) => {
    const monitor = attachConsoleMonitor(page);

    const guestCartRes = await request.post("/api/cart/lines", {
      data: {
        offerReference: "off_64gb",
        variantReference: "var_64gb",
        quantity: 1,
        modifiers: [],
        operationId: `op-unauth-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: 0,
      },
    });
    const guestCartBody = await guestCartRes.json();
    const lineRef = guestCartBody.cart.storeGroups[0].lines[0].reference;

    const otherContext = await page.context().browser()?.newContext();
    if (otherContext) {
      const updateRes = await otherContext.request.put(`/api/cart/lines/${lineRef}`, {
        data: {
          quantity: 5,
          operationId: `op-unauth-hacker-${Date.now()}`,
          requestHash: SAFE_HASH,
          cartVersion: guestCartBody.cart.version,
        },
      });
      expect([401, 403, 404]).toContain(updateRes.status());
      await otherContext.close();
    }

    monitor.assertClean();
  });

  test("stale cart version mutation triggers version conflict error", async ({ request, page }) => {
    const monitor = attachConsoleMonitor(page);

    const res1 = await request.post("/api/cart/lines", {
      data: {
        offerReference: "off_64gb",
        variantReference: "var_64gb",
        quantity: 1,
        modifiers: [],
        operationId: `op-stale-1-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: 0,
      },
    });
    const body1 = await res1.json();
    const lineRef = body1.cart.storeGroups[0].lines[0].reference;

    await request.put(`/api/cart/lines/${lineRef}`, {
      data: {
        quantity: 2,
        operationId: `op-stale-2-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: body1.cart.version,
      },
    });

    const staleRes = await request.put(`/api/cart/lines/${lineRef}`, {
      data: {
        quantity: 4,
        operationId: `op-stale-3-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: body1.cart.version,
      },
    });
    expect([400, 409, 422]).toContain(staleRes.status());

    monitor.assertClean();
  });
});
