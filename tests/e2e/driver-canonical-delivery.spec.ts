import { test } from "@playwright/test";
import { canonicalDriverDeliveryJourney } from "./fixtures/driver-delivery";
import { login } from "./fixtures/auth";
for (const width of [1440, 390]) test(`canonical assigned driver delivery, retry, private POD and synthetic location at ${width}px`, async ({ page }, info) => {
  test.setTimeout(240_000);
  const receipt = await canonicalDriverDeliveryJourney(page, `driver-delivery-${width}`, width, async actor => {
    await info.attach(`delivery-chat-${actor}-${width}`, { body: await page.screenshot({ fullPage: true, path: info.outputPath(`delivery-chat-${actor}-${width}.png`) }), contentType: "image/png" });
  });
  await page.reload();
  await info.attach(`driver-canonical-delivery-${width}`, { body: await page.screenshot({ fullPage: true, path: info.outputPath(`driver-canonical-delivery-${width}.png`) }), contentType: "image/png" });
  await info.attach("canonical-synthetic-driver-delivery", { body: JSON.stringify(receipt), contentType: "application/json" });
  await login(page, `e2e-paystack-driver-delivery-${width}@ktcouriers.local`);
  await page.goto(`/account/orders/${receipt.final.order.id}`);
  await info.attach(`customer-delivery-tracking-${width}`, { body: await page.screenshot({ fullPage: true, path: info.outputPath(`customer-delivery-tracking-${width}.png`) }), contentType: "image/png" });
});
