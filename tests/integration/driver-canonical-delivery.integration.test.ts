import { chromium } from "@playwright/test";
import { it, expect } from "vitest";
import { canonicalDriverDeliveryJourney } from "../e2e/fixtures/driver-delivery";
it("canonical PostgreSQL driver delivery persists OTP, private proof, attempt and immutable command receipts", async () => {
  if (!process.env.E2E_BASE_URL) throw new Error("Named disposable HTTP runtime is required.");
  const browser = await chromium.launch(); const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL });
  try { const receipt = await canonicalDriverDeliveryJourney(await context.newPage(), "driver-delivery-pg", 390); expect(receipt.final.commands.filter(row => row.type === "DELIVERY_COMPLETE")).toHaveLength(1); expect(receipt.final.attempts).toHaveLength(1); } finally { await context.close(); await browser.close(); }
}, 240_000);
