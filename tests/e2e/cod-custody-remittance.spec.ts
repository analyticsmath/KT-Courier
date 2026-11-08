import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { expect, test } from "@playwright/test";
import { prisma } from "@/lib/db/prisma";
import { codBooking, codReviewer, codState, codTransit, verifyCodDeposit } from "../integration/cod-canonical-support";
import { login } from "./fixtures/auth";
import { driverCashSummary, readBankInstructions, reviewDriverDeposit, saveBankInstructions, submitDriverDeposit } from "@/lib/client-platform/driver-cash.service";
import { assertCashReadyForDeliveryWithinTransaction } from "@/lib/services/cash-on-delivery.service";

for (const width of [1440, 390]) test(`native synthetic COD deposit, custody and independent remittance at ${width}px`, async ({ page, browser }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width, height: 900 });
  const f = await codBooking(page, String(width));
  const origin = process.env.E2E_BASE_URL!;
  const post = (data: object) => page.request.post(`/api/driver/orders/${f.order.id}/cod/collection`, { headers: { origin }, data });
  await login(page, f.driver.user.email);
  const walletCount = await prisma.wallet.count({ where: { ownerType: "DRIVER", ownerId: f.driver.id } });
  expect((await post({ amount: f.before.cod.cashObligation.toFixed(2), operationId: randomUUID() })).status()).toBe(400);
  expect(await prisma.wallet.count({ where: { ownerType: "DRIVER", ownerId: f.driver.id } })).toBe(walletCount);
  expect(await codState(f.order.id)).toEqual(f.before);
  const payment = await verifyCodDeposit(page, f); await codTransit(f);
  const ready = await codState(f.order.id);
  await expect(prisma.$transaction(tx => assertCashReadyForDeliveryWithinTransaction(tx, f.order.id, f.driver.id))).rejects.toMatchObject({ code: "COD_COLLECTION_REQUIRED" });
  expect(await codState(f.order.id)).toEqual(ready);
  const foreign = await browser.newContext({ baseURL: origin });
  try {
    const other = await foreign.newPage(); await login(other, "e2e-handoff-driver-foreign@ktcouriers.local");
    expect((await other.request.post(`/api/driver/orders/${f.order.id}/cod/collection`, { headers: { origin }, data: { amount: ready.cod.cashObligation.toFixed(2), operationId: randomUUID() } })).status()).toBe(400);
    expect((await other.request.get("/api/driver/cash")).status()).toBe(200);
    expect(JSON.stringify(await (await other.request.get("/api/driver/cash")).json())).not.toContain(f.order.id);
    expect(await codState(f.order.id)).toEqual(ready);
  } finally { await foreign.close(); }
  expect((await post({ amount: ready.cod.cashObligation.add("0.01").toFixed(2), operationId: randomUUID() })).status()).toBe(400); expect(await codState(f.order.id)).toEqual(ready);
  await page.goto("/driver/cash");
  const collectionResponse = page.waitForResponse(response => response.url().endsWith(`/orders/${f.order.id}/cod/collection`));
  await page.getByRole("button", { name: `I received R ${ready.cod.cashObligation.toFixed(2)} in cash`, exact: true }).click();
  const collectedResponse = await collectionResponse; expect(collectedResponse.status(), await collectedResponse.text()).toBe(200);
  const collection = collectedResponse.request().postDataJSON();
  const collected = await codState(f.order.id); expect(collected.cod.status).toBe("COLLECTED"); expect(collected.cod.cashCollected.equals(collected.cod.cashObligation)).toBe(true); expect(collected.cod.cashReconciled.isZero()).toBe(true);
  await prisma.$transaction(tx => assertCashReadyForDeliveryWithinTransaction(tx, f.order.id, f.driver.id)); expect(await codState(f.order.id)).toEqual(collected);
  expect(collected.journals).toHaveLength(1); expect(collected.journals[0].entries).toHaveLength(2); expect(collected.journals[0].totalDebits.equals(collected.cod.cashCollected)).toBe(true); expect(collected.journals[0].totalCredits.equals(collected.cod.cashCollected)).toBe(true);
  expect((await post(collection)).status()).toBe(200); expect(await codState(f.order.id)).toEqual(collected);
  expect((await post({ ...collection, amount: collected.cod.cashCollected.sub("0.01").toFixed(2) })).status()).toBe(400); expect(await codState(f.order.id)).toEqual(collected);
  const reviewer = await codReviewer(); const denied = await codReviewer(true);
  const bank = await readBankInstructions();
  if (!bank) {
    await expect(submitDriverDeposit(f.driver.userId, { orderId: f.order.id, amount: collected.cod.cashCollected.toFixed(2), operationId: randomUUID(), bankReference: "SYNTHETIC-UNVERIFIED", privateMediaReference: "PMO-" + randomUUID() })).rejects.toMatchObject({ code: "BANK_INSTRUCTIONS_MISSING" });
    expect(await codState(f.order.id)).toEqual(collected);
  }
  await saveBankInstructions(reviewer, { bankName: "DISPOSABLE TEST BANK — NO REAL TRANSFERS", accountName: "Synthetic disposable acceptance", accountNumber: "000000000000", branchCode: "000000", referenceHint: "Synthetic reference only; this runtime has no banking connection.", expectedVersion: bank?.expectedVersion ?? 0 });
  await page.reload(); await page.getByLabel("Bank deposit reference", { exact: true }).fill(`SYNTHETIC-${width}`);
  // Named disposable PNG demonstrates private-media upload, NOT a genuine
  // bank transfer. Production still requires a real slip and bank verification.
  const proof1 = await sharp({ create: {
    width: 40, height: 40, channels: 3, background: "#5b2546",
  } }).png().toBuffer();
  await page.getByLabel("Bank deposit slip (required)", { exact: true }).setInputFiles({
    name: "SYNTHETIC-NO-BANK-DEPOSIT-1.png", mimeType: "image/png", buffer: proof1,
  });
  const depositResponse = page.waitForResponse(response => response.url().endsWith("/api/driver/cash") && response.request().method() === "POST");
  await page.getByRole("button", { name: `Submit R ${collected.cod.cashCollected.toFixed(2)} deposit`, exact: true }).click();
  const deposited = await depositResponse; expect(deposited.status(), await deposited.text()).toBe(201);
  const pending = await codState(f.order.id); expect(pending.deposits).toHaveLength(1); expect(pending.deposits[0].status).toBe("PENDING"); expect(pending.journals).toEqual(collected.journals); expect(pending.cod.cashReconciled.isZero()).toBe(true);
  const initialId = pending.deposits[0].id;
  const usedProof = await prisma.privateMediaObject.findUniqueOrThrow({
    where: { id: pending.deposits[0].privateMediaObjectId! },
    select: { publicReference: true, purpose: true, status: true },
  });
  expect(usedProof).toMatchObject({ purpose: "DRIVER_CASH_DEPOSIT_RECEIPT", status: "READY" });
  const duplicate = await page.request.post("/api/driver/cash", { headers: { origin }, data: {
    orderId: f.order.id, amount: collected.cod.cashCollected.toFixed(2),
    bankReference: "SYNTHETIC-SECOND-SUBMISSION",
    privateMediaReference: usedProof.publicReference,
    operationId: randomUUID(),
  } });
  expect(duplicate.status()).toBe(409); expect(await codState(f.order.id)).toEqual(pending);
  await expect(reviewDriverDeposit(denied, initialId, { decision: "CONFIRM", note: "Synthetic test evidence only", bankReceiptVerified: true })).rejects.toMatchObject({ code: "CASH_REVIEW_FORBIDDEN" });
  await expect(reviewDriverDeposit(reviewer, initialId, { decision: "CONFIRM", note: "Unverified evidence must retain custody", bankReceiptVerified: false })).rejects.toThrow(); expect(await codState(f.order.id)).toEqual(pending);
  expect(await reviewDriverDeposit(reviewer, initialId, { decision: "REJECT", note: "Synthetic deposit reference requires correction", bankReceiptVerified: false })).toEqual({ id: initialId, status: "REJECTED" });
  const rejected = await codState(f.order.id); expect(rejected.cod).toEqual(pending.cod); expect(rejected.journals).toEqual(pending.journals);
  await page.reload(); await page.getByLabel("Bank deposit reference", { exact: true }).fill(`SYNTHETIC-CORRECTED-${width}`);
  // A rejected slip cannot be recycled as another remittance proof.
  const proof2 = await sharp({ create: {
    width: 40, height: 40, channels: 3, background: "#255b46",
  } }).png().toBuffer();
  await page.getByLabel("Bank deposit slip (required)", { exact: true }).setInputFiles({
    name: "SYNTHETIC-NO-BANK-DEPOSIT-2.png", mimeType: "image/png", buffer: proof2,
  });
  const correctedResponse = page.waitForResponse(response => response.url().endsWith("/api/driver/cash") && response.request().method() === "POST");
  await page.getByRole("button", { name: `Submit R ${collected.cod.cashCollected.toFixed(2)} deposit`, exact: true }).click(); expect((await correctedResponse).status()).toBe(201);
  const resubmitted = await codState(f.order.id); expect(resubmitted.deposits).toHaveLength(2); expect(resubmitted.journals).toEqual(pending.journals);
  const id = resubmitted.deposits.find(row => row.status === "PENDING")!.id;
  expect((await driverCashSummary(f.driver.userId)).totals.held).toBe(collected.cod.cashCollected.toFixed(2));
  expect(await reviewDriverDeposit(reviewer, id, { decision: "CONFIRM", note: "Synthetic bank receipt fixture; no actual cash transfer", bankReceiptVerified: true })).toEqual({ id, status: "CONFIRMED" });
  const final = await codState(f.order.id); expect(final.cod.status).toBe("RECONCILED"); expect(final.cod.cashReconciled.equals(final.cod.cashCollected)).toBe(true); expect(final.cod.reconciliations).toHaveLength(1); expect(final.journals).toHaveLength(2);
  for (const journal of final.journals) expect(journal.totalDebits.equals(journal.totalCredits)).toBe(true);
  expect((await driverCashSummary(f.driver.userId)).totals.held).toBe("0.00");
  expect(await reviewDriverDeposit(reviewer, id, { decision: "CONFIRM", note: "Synthetic bank receipt fixture; no actual cash transfer", bankReceiptVerified: true })).toEqual({ id, status: "CONFIRMED" }); expect(await codState(f.order.id)).toEqual(final);
  const captured = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }); expect(captured.amount.equals(payment.amount)).toBe(true); expect(captured.status).toBe("SUCCEEDED"); expect(captured.totalRefundedAmount.isZero()).toBe(true);
  await page.reload(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ fullPage: true, path: info.outputPath(`synthetic-cod-${width}.png`) });
  await info.attach("synthetic-cod-authority", { body: JSON.stringify({ evidenceClass: "OFFLINE_SYNTHETIC_NO_PHYSICAL_BANK_OR_CASH_ACCEPTANCE", viewport: width, digital: payment.amount.toFixed(2), cash: final.cod.cashCollected.toFixed(2), balancedCustodyJournals: final.journals.length, separateReviewer: reviewer.id !== f.driver.userId, oneReconciliation: final.cod.reconciliations.length }), contentType: "application/json" });
});
