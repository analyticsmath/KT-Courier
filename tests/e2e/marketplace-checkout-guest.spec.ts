import { expect, test as baseTest } from "@playwright/test";
import { attachConsoleMonitor } from "./fixtures/console-monitor";

const isLocalValidationServerAvailable = Boolean(
  process.env.PLAYWRIGHT_BASE_URL || process.env.KT_LOCAL_STOREFRONT_VALIDATION === "true"
);

const SAFE_HASH = "request-hash-1234567890123456";

const test = baseTest.extend({
  request: async ({ page }, provide) => {
    await provide(page.request);
  },
});

test.describe("Marketplace Guest Checkout Journey", () => {
  test.beforeEach(() => {
    test.skip(!isLocalValidationServerAvailable, "Requires active local app instance with KT_LOCAL_STOREFRONT_VALIDATION=true");
  });

  test("checkout creation from active cart initializes canonical checkout reference and store groups", async ({ request, page }) => {
    const monitor = attachConsoleMonitor(page);

    const cartRes = await request.post("/api/cart/lines", {
      data: {
        offerReference: "CO-E2E64GB",
        variantReference: "CV-E2E64GB",
        quantity: 1,
        modifiers: [],
        operationId: `op-chk-create-cart-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: 1,
      },
    });
    expect(cartRes.status()).toBe(201);
    const cartBody = await cartRes.json();
    const cartRef = cartBody.cart.reference;

    const chkRes = await request.post("/api/checkout", {
      data: { cartReference: cartRef },
    });
    expect(chkRes.status()).toBe(201);
    const chkBody = await chkRes.json();

    expect(chkBody.checkout.reference).toBeDefined();
    expect(chkBody.checkout.status).toBe("CHANGES_REQUIRED");
    expect(chkBody.checkout.totals.merchandiseSubtotal).toBe("1500.00");

    monitor.assertClean();
  });

  test("contact details submission persists valid contact and rejects invalid input", async ({ request, page }) => {
    const monitor = attachConsoleMonitor(page);

    const cartRes = await request.post("/api/cart/lines", {
      data: {
        offerReference: "CO-E2E64GB",
        variantReference: "CV-E2E64GB",
        quantity: 1,
        modifiers: [],
        operationId: `op-contact-cart-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: 1,
      },
    });
    const cartBody = await cartRes.json();
    const chkRes = await request.post("/api/checkout", { data: { cartReference: cartBody.cart.reference } });
    const chkBody = await chkRes.json();
    const chkRef = chkBody.checkout.reference;
    let version = chkBody.checkout.version;

    const validRes = await request.put(`/api/checkout/${chkRef}/contact`, {
      data: {
        recipientName: "John Smith",
        email: "john.smith@example.com",
        phone: "+27110001111",
        preferredContactMethod: "EMAIL",
        operationId: `op-contact-valid-${Date.now()}`,
        requestHash: SAFE_HASH,
        checkoutVersion: version,
      },
    });
    expect(validRes.status()).toBe(200);
    const validBody = await validRes.json();
    expect(validBody.checkout.status).toBe("VALIDATING");
    version = validBody.checkout.version;

    const invalidRes = await request.put(`/api/checkout/${chkRef}/contact`, {
      data: {
        recipientName: "John Smith",
        email: "invalid-email-address",
        phone: "123",
        preferredContactMethod: "EMAIL",
        operationId: `op-contact-inv-${Date.now()}`,
        requestHash: SAFE_HASH,
        checkoutVersion: version,
      },
    });
    expect([400, 422]).toContain(invalidRes.status());

    monitor.assertClean();
  });

  test("delivery address submission updates checkout address snapshot and rejects client fee manipulation", async ({ request, page }) => {
    const monitor = attachConsoleMonitor(page);

    const cartRes = await request.post("/api/cart/lines", {
      data: {
        offerReference: "CO-E2E64GB",
        variantReference: "CV-E2E64GB",
        quantity: 1,
        modifiers: [],
        operationId: `op-addr-cart-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: 1,
      },
    });
    const cartBody = await cartRes.json();
    const chkRes = await request.post("/api/checkout", { data: { cartReference: cartBody.cart.reference } });
    const chkBody = await chkRes.json();
    const chkRef = chkBody.checkout.reference;

    const addrRes = await request.put(`/api/checkout/${chkRef}/delivery-address`, {
      data: {
        recipientName: "John Smith",
        line1: "45 Commission St",
        line2: "",
        suburb: "Central",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2001",
        deliveryInstructions: "Leave at reception",
        serviceAreaReference: "PRIMARY",
        operationId: `op-addr-valid-${Date.now()}`,
        requestHash: SAFE_HASH,
        checkoutVersion: chkBody.checkout.version,
      },
    });
    expect(addrRes.status()).toBe(200);
    const addrBody = await addrRes.json();
    expect(addrBody.checkout.status).toBe("VALIDATING");

    monitor.assertClean();
  });

  test("delivery quote retrieval returns source-backed quote evidence", async ({ request, page }) => {
    const monitor = attachConsoleMonitor(page);

    const cartRes = await request.post("/api/cart/lines", {
      data: {
        offerReference: "CO-E2E64GB",
        variantReference: "CV-E2E64GB",
        quantity: 1,
        modifiers: [],
        operationId: `op-quote-cart-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: 1,
      },
    });
    const cartBody = await cartRes.json();
    const chkRes = await request.post("/api/checkout", { data: { cartReference: cartBody.cart.reference } });
    const chkBody = await chkRes.json();
    const chkRef = chkBody.checkout.reference;

    const addressRes = await request.put(`/api/checkout/${chkRef}/delivery-address`, {
      data: { recipientName: "Disposable Recipient", line1: "45 Commission St", suburb: "Central", city: "Johannesburg", province: "Gauteng", postalCode: "2001", operationId: `op-quote-address-${crypto.randomUUID()}`, requestHash: SAFE_HASH, checkoutVersion: chkBody.checkout.version },
    });
    expect(addressRes.status(), await addressRes.text()).toBe(200);
    const addressBody = await addressRes.json();
    const quotesRes = await request.post(`/api/checkout/${chkRef}/delivery-quotes`, {
      data: { operationId: `op-quote-${crypto.randomUUID()}`, requestHash: SAFE_HASH, checkoutVersion: addressBody.checkout.version },
    });
    expect(quotesRes.status(), await quotesRes.text()).toBe(200);
    const quotesBody = await quotesRes.json();
    expect(quotesBody.quotes).toHaveLength(1);
    expect(quotesBody.quotes[0]).toMatchObject({ currency: "ZAR", fee: expect.stringMatching(/^\d+\.\d{2}$/), publicReference: expect.any(String), version: expect.any(String), serviceabilityReference: expect.any(String) });

    monitor.assertClean();
  });

  test("checkout review calculates expected totals against fixture prices", async ({ request, page }) => {
    const monitor = attachConsoleMonitor(page);

    const cartRes = await request.post("/api/cart/lines", {
      data: {
        offerReference: "CO-E2E64GB",
        variantReference: "CV-E2E64GB",
        quantity: 1,
        modifiers: [],
        operationId: `op-rev-cart-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: 1,
      },
    });
    const cartBody = await cartRes.json();
    const chkRes = await request.post("/api/checkout", { data: { cartReference: cartBody.cart.reference } });
    const chkBody = await chkRes.json();
    const chkRef = chkBody.checkout.reference;
    let version = chkBody.checkout.version;

    const contactRes = await request.put(`/api/checkout/${chkRef}/contact`, {
      data: {
        recipientName: "John Smith",
        email: "john.smith@example.com",
        phone: "+27110001111",
        preferredContactMethod: "EMAIL",
        operationId: `op-rev-contact-${Date.now()}`,
        requestHash: SAFE_HASH,
        checkoutVersion: version,
      },
    });
    const contactBody = await contactRes.json();
    version = contactBody.checkout.version;

    const addrRes = await request.put(`/api/checkout/${chkRef}/delivery-address`, {
      data: {
        recipientName: "John Smith",
        line1: "45 Commission St",
        line2: "",
        suburb: "Central",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2001",
        deliveryInstructions: "Leave at reception",
        serviceAreaReference: "PRIMARY",
        operationId: `op-rev-addr-${Date.now()}`,
        requestHash: SAFE_HASH,
        checkoutVersion: version,
      },
    });
    const addrBody = await addrRes.json();
    version = addrBody.checkout.version;

    const revRes = await request.post(`/api/checkout/${chkRef}/review`, {
      data: {
        operationId: `op-rev-act-${Date.now()}`,
        requestHash: SAFE_HASH,
        checkoutVersion: version,
      },
    });

    expect(revRes.status()).toBe(200);
    const revBody = await revRes.json();
    expect(revBody.merchandiseSubtotal).toBe("1500.00");
    expect(revBody.commercialFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(revBody.legalEvidence.termsVersion).toMatch(/:[a-f0-9]{64}$/);

    await page.goto(`/checkout/${chkRef}/review`);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("h1")).toContainText("Review your order");

    monitor.assertClean();
  });

  test("review acknowledgement updates accepted state and blocks unacknowledged progression", async ({ request, page }) => {
    const monitor = attachConsoleMonitor(page);

    const cartRes = await request.post("/api/cart/lines", {
      data: {
        offerReference: "CO-E2E64GB",
        variantReference: "CV-E2E64GB",
        quantity: 1,
        modifiers: [],
        operationId: `op-ack-cart-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: 1,
      },
    });
    const cartBody = await cartRes.json();
    const chkRes = await request.post("/api/checkout", { data: { cartReference: cartBody.cart.reference } });
    const chkBody = await chkRes.json();
    const chkRef = chkBody.checkout.reference;
    let version = chkBody.checkout.version;

    const contactRes = await request.put(`/api/checkout/${chkRef}/contact`, {
      data: {
        recipientName: "John Smith",
        email: "john.smith@example.com",
        phone: "+27110001111",
        preferredContactMethod: "EMAIL",
        operationId: `op-ack-contact-${Date.now()}`,
        requestHash: SAFE_HASH,
        checkoutVersion: version,
      },
    });
    version = (await contactRes.json()).checkout.version;

    const addrRes = await request.put(`/api/checkout/${chkRef}/delivery-address`, {
      data: {
        recipientName: "John Smith",
        line1: "45 Commission St",
        line2: "",
        suburb: "Central",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2001",
        deliveryInstructions: "Leave at reception",
        serviceAreaReference: "PRIMARY",
        operationId: `op-ack-addr-${Date.now()}`,
        requestHash: SAFE_HASH,
        checkoutVersion: version,
      },
    });
    version = (await addrRes.json()).checkout.version;

    const revRes = await request.post(`/api/checkout/${chkRef}/review`, {
      data: {
        operationId: `op-ack-rev-${Date.now()}`,
        requestHash: SAFE_HASH,
        checkoutVersion: version,
      },
    });
    const revBody = await revRes.json();
    expect(revRes.status(), await revRes.text()).toBe(200);
    const reviewedCheckout = await request.get(`/api/checkout/${chkRef}`);
    expect(reviewedCheckout.status()).toBe(200);
    version = (await reviewedCheckout.json()).checkout.version;

    const earlyPayRes = await request.post(`/api/checkout/${chkRef}/prepare-payment`, {
      data: {
        checkoutVersion: version,
        operationId: `op-early-pay-${Date.now()}`,
        requestHash: SAFE_HASH,
      },
    });
    expect(earlyPayRes.status()).toBe(422);
    expect(await earlyPayRes.json()).toMatchObject({ code: "CHECKOUT_REVIEW_REQUIRED" });

    const ackRes = await request.post(`/api/checkout/${chkRef}/acknowledge`, {
      data: {
        operationId: `op-ack-do-${Date.now()}`,
        requestHash: SAFE_HASH,
        checkoutVersion: version,
        reviewVersion: revBody.reviewVersion,
        commercialFingerprint: revBody.commercialFingerprint,
        acknowledgedTotalReference: revBody.grandTotal,
        ...revBody.legalEvidence,
      },
    });

    expect(ackRes.status()).toBe(200);

    monitor.assertClean();
  });

  test("cart or address modification invalidates previous review acknowledgement", async ({ request, page }) => {
    const monitor = attachConsoleMonitor(page);

    const cartRes = await request.post("/api/cart/lines", {
      data: {
        offerReference: "CO-E2E64GB",
        variantReference: "CV-E2E64GB",
        quantity: 1,
        modifiers: [],
        operationId: `op-inval-cart-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: 1,
      },
    });
    const cartBody = await cartRes.json();
    const chkRes = await request.post("/api/checkout", { data: { cartReference: cartBody.cart.reference } });
    const chkBody = await chkRes.json();
    const chkRef = chkBody.checkout.reference;
    let version = chkBody.checkout.version;

    const contactRes = await request.put(`/api/checkout/${chkRef}/contact`, {
      data: {
        recipientName: "John Smith",
        email: "john.smith@example.com",
        phone: "+27110001111",
        preferredContactMethod: "EMAIL",
        operationId: `op-inval-contact-${Date.now()}`,
        requestHash: SAFE_HASH,
        checkoutVersion: version,
      },
    });
    version = (await contactRes.json()).checkout.version;

    const addrRes = await request.put(`/api/checkout/${chkRef}/delivery-address`, {
      data: {
        recipientName: "John Smith",
        line1: "45 Commission St",
        line2: "",
        suburb: "Central",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2001",
        deliveryInstructions: "Leave at reception",
        serviceAreaReference: "PRIMARY",
        operationId: `op-inval-addr-${Date.now()}`,
        requestHash: SAFE_HASH,
        checkoutVersion: version,
      },
    });
    version = (await addrRes.json()).checkout.version;

    const revRes = await request.post(`/api/checkout/${chkRef}/review`, {
      data: {
        operationId: `op-inval-rev-${Date.now()}`,
        requestHash: SAFE_HASH,
        checkoutVersion: version,
      },
    });
    expect(revRes.status(), await revRes.text()).toBe(200);
    const reviewedCheckout = await request.get(`/api/checkout/${chkRef}`);
    expect(reviewedCheckout.status()).toBe(200);
    version = (await reviewedCheckout.json()).checkout.version;

    const contactUpdate2 = await request.put(`/api/checkout/${chkRef}/contact`, {
      data: {
        recipientName: "Jane Doe Updated",
        email: "jane.updated@example.com",
        phone: "+27110002222",
        preferredContactMethod: "EMAIL",
        operationId: `op-inval-contact2-${Date.now()}`,
        requestHash: SAFE_HASH,
        checkoutVersion: version,
      },
    });
    const contactUpdate2Body = await contactUpdate2.json();
    const newVersion = contactUpdate2Body.checkout.version;

    const payRes = await request.post(`/api/checkout/${chkRef}/prepare-payment`, {
      data: {
        checkoutVersion: newVersion,
        operationId: `op-inval-pay-${Date.now()}`,
        requestHash: SAFE_HASH,
      },
    });

    expect(payRes.status()).toBe(422);
    const payBody = await payRes.json();
    expect(JSON.stringify(payBody)).toContain("CHECKOUT_REVIEW_REQUIRED");

    monitor.assertClean();
  });

  test("payment preparation requires review and preserves the unpaid checkout", async ({ request, page }) => {
    const monitor = attachConsoleMonitor(page);

    const cartRes = await request.post("/api/cart/lines", {
      data: {
        offerReference: "CO-E2E64GB",
        variantReference: "CV-E2E64GB",
        quantity: 1,
        modifiers: [],
        operationId: `op-paydis-cart-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: 1,
      },
    });
    const cartBody = await cartRes.json();
    const chkRes = await request.post("/api/checkout", { data: { cartReference: cartBody.cart.reference } });
    const chkBody = await chkRes.json();
    const chkRef = chkBody.checkout.reference;
    let version = chkBody.checkout.version;

    const contactRes = await request.put(`/api/checkout/${chkRef}/contact`, {
      data: {
        recipientName: "John Smith",
        email: "john.smith@example.com",
        phone: "+27110001111",
        preferredContactMethod: "EMAIL",
        operationId: `op-paydis-contact-${Date.now()}`,
        requestHash: SAFE_HASH,
        checkoutVersion: version,
      },
    });
    version = (await contactRes.json()).checkout.version;

    const before = await request.get(`/api/checkout/${chkRef}/status`);
    expect(before.status()).toBe(200);
    const beforeBody = await before.json();
    const payRes = await request.post(`/api/checkout/${chkRef}/prepare-payment`, {
      data: {
        checkoutVersion: version,
        operationId: `op-paydis-prep-${Date.now()}`,
        requestHash: SAFE_HASH,
      },
    });

    expect(payRes.status()).toBe(422);
    const payBody = await payRes.json();
    expect(payBody).toMatchObject({ code: "CHECKOUT_REVIEW_REQUIRED" });
    const after = await request.get(`/api/checkout/${chkRef}/status`);
    expect(after.status()).toBe(200);
    expect((await after.json()).checkout).toEqual(beforeBody.checkout);

    await page.goto(`/checkout/${chkRef}/payment`);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Continue to payment");

    monitor.assertClean();
  });

  test("repeated unreviewed payment commands return the same rejection", async ({ request, page }) => {
    const monitor = attachConsoleMonitor(page);

    const cartRes = await request.post("/api/cart/lines", {
      data: {
        offerReference: "CO-E2E64GB",
        variantReference: "CV-E2E64GB",
        quantity: 1,
        modifiers: [],
        operationId: `op-payrep-cart-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: 1,
      },
    });
    const cartBody = await cartRes.json();
    const chkRes = await request.post("/api/checkout", { data: { cartReference: cartBody.cart.reference } });
    const chkBody = await chkRes.json();
    const chkRef = chkBody.checkout.reference;

    const opId = `op-payrep-shared-${Date.now()}`;
    const payload = {
      checkoutVersion: chkBody.checkout.version,
      operationId: opId,
      requestHash: SAFE_HASH,
    };

    const res1 = await request.post(`/api/checkout/${chkRef}/prepare-payment`, { data: payload });
    const res2 = await request.post(`/api/checkout/${chkRef}/prepare-payment`, { data: payload });

    expect(res1.status()).toBe(422);
    expect(res2.status()).toBe(422);
    const body1 = await res1.json();
    const body2 = await res2.json();
    expect(body1).toEqual(body2);
    expect(body1).toMatchObject({ code: "CHECKOUT_REVIEW_REQUIRED" });

    monitor.assertClean();
  });

  test("browser return route with fake parameters does not alter payment state or confirm order", async ({ request, page }) => {
    const monitor = attachConsoleMonitor(page);

    const cartRes = await request.post("/api/cart/lines", {
      data: {
        offerReference: "CO-E2E64GB",
        variantReference: "CV-E2E64GB",
        quantity: 1,
        modifiers: [],
        operationId: `op-return-cart-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: 1,
      },
    });
    const cartBody = await cartRes.json();
    const chkRes = await request.post("/api/checkout", { data: { cartReference: cartBody.cart.reference } });
    const chkBody = await chkRes.json();
    const chkRef = chkBody.checkout.reference;

    const before = await request.get(`/api/checkout/${chkRef}/status`);
    expect(before.status()).toBe(200);
    const beforeBody = await before.json();
    await page.goto(`/checkout/${chkRef}/return?reference=forged-paystack-reference&trxref=forged-paystack-reference&payment_status=COMPLETE`);

    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).toContainText("Confirming your payment");

    await expect(page.locator("body")).toContainText("Payment confirmation may take a moment");

    const statusRes = await request.get(`/api/checkout/${chkRef}/status`);
    expect(statusRes.status()).toBe(200);
    const statusBody = await statusRes.json();
    expect(statusBody.checkout).toEqual(beforeBody.checkout);
    expect(statusBody.checkout.status).toBe("CHANGES_REQUIRED");

    monitor.assertClean();
  });

  test("unauthorized checkout access from different context returns safe access denial", async ({ request, page, browser }) => {
    const monitor = attachConsoleMonitor(page);

    const cartRes = await request.post("/api/cart/lines", {
      data: {
        offerReference: "CO-E2E64GB",
        variantReference: "CV-E2E64GB",
        quantity: 1,
        modifiers: [],
        operationId: `op-unauthchk-cart-${Date.now()}`,
        requestHash: SAFE_HASH,
        cartVersion: 1,
      },
    });
    const cartBody = await cartRes.json();
    const chkRes = await request.post("/api/checkout", { data: { cartReference: cartBody.cart.reference } });
    const chkBody = await chkRes.json();
    const chkRef = chkBody.checkout.reference;

    const otherContext = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL });
    try {
      const accessRes = await otherContext.request.get(`/api/checkout/${chkRef}`);
      expect(accessRes.status()).toBe(401);
      const body = await accessRes.json();
      expect(body).not.toHaveProperty("checkout");
      const ownCartRes = await otherContext.request.get("/api/cart");
      expect(ownCartRes.status()).toBe(200);
      const ownCart = (await ownCartRes.json()).cart;
      const ownLine = await otherContext.request.post("/api/cart/lines", { data: { offerReference: "CO-E2E64GB", variantReference: "CV-E2E64GB", quantity: 1, modifiers: [], operationId: crypto.randomUUID(), requestHash: SAFE_HASH, cartVersion: ownCart.version } });
      expect(ownLine.status()).toBe(201);
      const ownCheckout = await otherContext.request.post("/api/checkout", { data: { cartReference: (await ownLine.json()).cart.reference } });
      expect(ownCheckout.status()).toBe(201);
      const foreignAccess = await otherContext.request.get(`/api/checkout/${chkRef}`);
      expect(foreignAccess.status()).toBe(404);
      expect(await foreignAccess.json()).not.toHaveProperty("checkout");
    } finally { await otherContext.close(); }

    monitor.assertClean();
  });
});
