import { expect, test } from "@playwright/test";
import { login } from "./auth";
import { prepareStoreOrder, storeControl, storeAction, customerAction } from "./store-order";
import { completeSyntheticStoreHandoff } from "./store-handoff";
import { proveStoreOrderEmployeeScope } from "./store-order-employee";
import { refundControl, assertBalancedRefundJournal } from "./refund";

export function storeOrderScenarios(domain: "customer" | "merchant" | "admin" | "substitution" | "handoff" | "accessibility") {
  for (const width of domain === "accessibility" ? [1440, 768, 390, 320] : [1440, 390]) test(`canonical ${domain} store-order journey at ${width}px`, async ({ page }, info) => {
    test.setTimeout(180_000);
    const f = await prepareStoreOrder(page, `store-${domain}-${width}`, width);
    const postStore = async (body: Record<string, unknown>) => { const response = await storeAction(page, f.storeReference, body); expect(response.status(), await response.text()).toBe(200); return (await response.json()).result; };
    if (domain === "customer") {
      await page.goto(`/order-confirmation/${f.order.publicReference}`);
      const controls = page.getByRole("region", { name: `Order decisions for ${f.storeReference}`, exact: true });
      await controls.getByText("Request cancellation of this store order", { exact: true }).click();
      await controls.getByRole("checkbox", { name: "I want to cancel this store order.", exact: true }).check();
      const requested = page.waitForResponse(response => response.url().endsWith(`/store-orders/${f.storeReference}/actions`) && response.request().method() === "POST");
      await controls.getByRole("button", { name: "Confirm cancellation request", exact: true }).click();
      const response = await requested;
      const body = response.request().postDataJSON(); const operationId = body.operationId as string;
      expect(response.status(), await response.text()).toBe(200);
      expect((await response.json()).result).toMatchObject({ status: "APPROVED", replayed: false });
      const after = await storeControl(f.storeReference);
      expect(after.cancellations).toEqual([{ status: "APPROVED", operationId }]);
      expect(after.payment).toEqual(f.baseline.payment); expect(after.journalCount).toBe(f.baseline.journalCount);
      const replay = await customerAction(page, f.order.publicReference, f.storeReference, body);
      expect(replay.status()).toBe(200); expect((await replay.json()).result.replayed).toBe(true);
      expect((await customerAction(page, f.order.publicReference, f.storeReference, { ...body, reasonCode: "DIFFERENT_REASON" })).status()).toBe(409);
      expect(after.preparationStatus).toBe("ABORTED"); expect(after.adjustments).toHaveLength(1);
      const funded = await refundControl(f.reference, "apply-store-adjustment", { storeOrderReference: f.storeReference, adjustmentReference: after.adjustments[0].publicReference });
      const refund = funded.refunds[0]; expect(refund.status).toBe("REQUESTED"); assertBalancedRefundJournal(refund.reserve, "REFUND_RESERVE", refund.amount);
      await refundControl(f.reference, "approve", { reference: refund.reference });
      const paid = await refundControl(f.reference, "start-provider", { reference: refund.reference, outcome: "processed" });
      expect(paid.payment.refunded).toBe(paid.payment.amount); expect(paid.payment.reserved).toBe("0.00");
      assertBalancedRefundJournal(paid.refunds[0].completion, "REFUND_EXTERNAL_PAYOUT", refund.amount);
      const completed = await storeControl(f.storeReference); expect(completed.resolutionStatus).toBe("RESOLVED"); expect(completed.stock).toEqual(after.stock);
      expect(completed.cancellations).toEqual([{ status: "APPLIED", operationId }]);
      await page.reload(); await expect(page.getByText("Refund completed", { exact: false }).first()).toBeVisible();
      await info.attach(`customer-order-refunded-${width}`, { body: await page.screenshot({ fullPage: true, path: info.outputPath(`customer-order-refunded-${width}.png`) }), contentType: "image/png" });
      await login(page, "e2e-checkout-other@ktcouriers.local");
      expect((await customerAction(page, f.order.publicReference, f.storeReference, body)).status()).toBe(404);
      expect((await storeControl(f.storeReference)).cancellations).toEqual(completed.cancellations);
      await page.context().clearCookies();
      expect((await page.request.get(`/api/marketplace-orders/${f.order.publicReference}/tracking`)).status()).toBe(401);
    } else if (domain === "admin") {
      const url = `/api/admin/store-orders/${f.storeReference}/rescan`; const body = { operationId: crypto.randomUUID() };
      expect((await page.request.post(url, { data: body, headers: { origin: new URL(page.url()).origin } })).status()).toBe(403);
      expect(await storeControl(f.storeReference)).toEqual(f.baseline);
      await login(page, "superadmin@ktcouriers.local");
      expect((await page.request.post(url, { data: body, headers: { origin: "https://foreign.example.test" } })).status()).toBe(403);
      const response = await page.request.post(url, { data: body, headers: { origin: new URL(page.url()).origin } }); expect(response.status(), await response.text()).toBe(200);
      const after = await storeControl(f.storeReference);
      expect(after.resolutionStatus).toBe("RECONCILIATION_REQUIRED"); expect(after.financialResolutionStatus).toBe("RECONCILIATION_REQUIRED");
      expect(after.reconciliation).toEqual([expect.objectContaining({ reasonCode: "ADMIN_CANONICAL_RESCAN", status: "OPEN" })]);
      expect(after.payment).toEqual(f.baseline.payment); expect(after.journalCount).toBe(f.baseline.journalCount);
      expect((await page.request.post(url, { data: body, headers: { origin: new URL(page.url()).origin } })).status()).toBe(200);
      expect((await storeControl(f.storeReference)).history).toEqual(after.history);
      await page.goto("/admin/store-order-reconciliation");
      await expect(page.getByRole("heading", { name: "Store-order reconciliation", exact: true })).toBeVisible();
      const cases = page.getByRole("table", { name: "Marketplace store-order operational reconciliation cases", exact: true });
      await expect(cases.getByText(f.storeReference, { exact: true })).toBeVisible();
      await expect(cases).toContainText("ADMIN_CANONICAL_RESCAN");
      await info.attach(`admin-store-reconciliation-${width}`, { body: await page.screenshot({ fullPage: true, path: info.outputPath(`admin-store-reconciliation-${width}.png`) }), contentType: "image/png" });
    } else if (domain === "substitution") {
      const pref = await customerAction(page, f.order.publicReference, f.storeReference, { action: "substitution-preference", orderLineId: f.baseline.lines[0].id, preference: "CONTACT_ME" }); expect(pref.status(), await pref.text()).toBe(200);
      await login(page, "e2e-store@ktcouriers.local");
      const issue = await postStore({ action: "confirm-availability", orderLineId: f.baseline.lines[0].id, availableQuantity: 0 });
      const before = await storeControl(f.storeReference);
      const proposal = await postStore({ action: "propose-substitution", issueReference: issue.issueReference, offerReference: "off_headphones", variantReference: "CV-E2EHEADPHONES", quantity: 1 });
      const reserved = await storeControl(f.storeReference);
      expect(reserved.proposals).toEqual([expect.objectContaining({ publicReference: proposal.proposalReference, status: "PROPOSED", reservation: { status: "ACTIVE" } })]);
      expect(reserved.stock.reduce((sum, row) => sum + row.reserved, 0)).toBe(before.stock.reduce((sum, row) => sum + row.reserved, 0) + 1);
      expect(reserved.stock.every(row => row.onHand === row.available + row.reserved)).toBe(true);
      const body = { action: "decide-substitution", proposalReference: proposal.proposalReference, decision: "REJECT_AND_REFUND", operationId: crypto.randomUUID() };
      await login(page, "e2e-checkout-other@ktcouriers.local"); expect((await customerAction(page, f.order.publicReference, f.storeReference, body)).status()).toBe(404);
      await login(page, `e2e-paystack-store-substitution-${width}@ktcouriers.local`);
      const rejected = await customerAction(page, f.order.publicReference, f.storeReference, body); expect(rejected.status(), await rejected.text()).toBe(200);
      const after = await storeControl(f.storeReference);
      expect(after.proposals[0]).toMatchObject({ status: "REJECTED", reservation: { status: "RELEASED" } });
      expect(after.stock).toEqual(before.stock); expect(after.adjustments).toHaveLength(1); expect(after.payment).toEqual(before.payment);
      expect((await customerAction(page, f.order.publicReference, f.storeReference, body)).status()).toBe(200);
      expect(await storeControl(f.storeReference)).toEqual(after);
      await info.attach("substitution-stock-receipt", { body: JSON.stringify({ before, reserved, after }), contentType: "application/json" });
    } else {
      await login(page, "e2e-other-store@ktcouriers.local"); expect((await storeAction(page, f.storeReference, { action: "begin-review" })).status()).toBe(404);
      expect(await storeControl(f.storeReference)).toEqual(f.baseline);
      await login(page, "e2e-store@ktcouriers.local"); await page.goto(`/store/marketplace-orders/${f.storeReference}`);
      await expect(page.getByRole("heading", { name: f.storeReference, exact: true })).toBeVisible();
      if (domain === "merchant") {
        await proveStoreOrderEmployeeScope(page, f.storeReference, width);
        await page.goto(`/store/marketplace-orders/${f.storeReference}`);
      }
      if (domain === "accessibility") {
        const input = page.getByLabel("Preparation time (minutes)"); await input.focus(); await expect(input).toBeFocused();
        await page.keyboard.press("Tab"); await expect(page.getByLabel("Pickup instructions")).toBeFocused();
        await page.getByRole("button", { name: "Accept order", exact: true }).click();
        expect(await input.evaluate((element: HTMLInputElement) => element.validity.valid)).toBe(false);
        expect(await storeControl(f.storeReference)).toEqual(f.baseline);
        await input.fill("30"); await page.getByLabel("Pickup instructions").fill("Disposable pickup point");
        await page.getByRole("button", { name: "Accept order", exact: true }).click();
        await expect(page.locator('.eo-store-action-message[role="alert"]')).toContainText("could not complete"); expect(await storeControl(f.storeReference)).toEqual(f.baseline);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        for (const button of await page.getByRole("button", { name: /Begin review|Confirm availability|Accept order/ }).all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        if (width === 1440) {
          await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await input.focus(); await expect(input).toBeFocused();
          await page.keyboard.press("Tab"); await expect(page.getByLabel("Pickup instructions")).toBeFocused();
          await expect(page.getByRole("button", { name: "Accept order", exact: true })).toBeVisible();
          expect(await storeControl(f.storeReference)).toEqual(f.baseline);
          await info.attach("store-order-200-percent", { body: await page.screenshot({ fullPage: true, path: info.outputPath("store-order-200-percent.png") }), contentType: "image/png" });
          await page.evaluate(() => { document.documentElement.style.zoom = ""; });
        }
        await info.attach(`store-order-${width}`, { body: await page.screenshot({ fullPage: true, path: info.outputPath(`store-order-${width}.png`) }), contentType: "image/png" });
      } else {
        if (domain === "handoff") {
          const premature = await storeAction(page, f.storeReference, { action: "generate-pickup-code" }); expect(premature.status()).toBe(422); expect((await premature.json()).code).toBe("STORE_ORDER_HANDOFF_NOT_READY");
          expect(await storeControl(f.storeReference)).toEqual(f.baseline);
        }
        if (domain !== "merchant") await postStore({ action: "begin-review" });
        await page.reload(); await page.getByRole("button", { name: "Confirm availability", exact: true }).click();
        await expect.poll(async () => (await storeControl(f.storeReference)).lines[0].fulfilment.status).toBe("AVAILABLE");
        await page.getByLabel("Preparation time (minutes)").fill("30"); await page.getByLabel("Pickup instructions").fill("Disposable confirmed pickup point");
        await page.getByRole("button", { name: "Accept order", exact: true }).click(); await expect.poll(async () => (await storeControl(f.storeReference)).acceptanceStatus).toBe("ACCEPTED");
        await page.reload(); await page.getByRole("button", { name: "Start preparation", exact: true }).click(); await expect.poll(async () => (await storeControl(f.storeReference)).preparationStatus).toBe("PREPARING");
        await page.reload(); await page.getByRole("button", { name: "Mark ready for collection", exact: true }).click(); await expect.poll(async () => (await storeControl(f.storeReference)).preparationStatus).toBe("READY_FOR_HANDOFF");
        const ready = await storeControl(f.storeReference); expect(ready.payment).toEqual(f.baseline.payment);
        await info.attach(`store-order-ready-${width}`, { body: await page.screenshot({ fullPage: true, path: info.outputPath(`store-order-ready-${width}.png`) }), contentType: "image/png" });
        if (domain === "handoff") {
          const unassigned = await storeAction(page, f.storeReference, { action: "generate-pickup-code" }); expect(unassigned.status()).toBe(422);
          expect(["STORE_ORDER_DRIVER_ASSIGNMENT_INVALID", "STORE_ORDER_HANDOFF_NOT_READY"]).toContain((await unassigned.json()).code);
          expect(await storeControl(f.storeReference)).toEqual(ready);
          await completeSyntheticStoreHandoff(page, f.storeReference, `store-handoff-${width}`);
        }
        expect(ready.history.map(h => h.eventType)).toEqual(expect.arrayContaining(["STORE_ORDER_REVIEW_BEGUN", "LINE_AVAILABILITY_CONFIRMED", "STORE_ORDER_ACCEPTED"]));
      }
    }
    await info.attach("store-order-canonical-postgres", { body: JSON.stringify({ before: f.baseline, after: await storeControl(f.storeReference) }), contentType: "application/json" });
  });
}
