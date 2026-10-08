import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import { expect, type Page } from "@playwright/test";
import { login } from "./auth";
import { prepareStoreOrder, storeAction, storeControl } from "./store-order";
import { completeSyntheticStoreHandoff } from "./store-handoff";
import { assertDisposablePaystackAcceptance } from "../../../lib/testing/disposable-paystack-policy";

const execute = promisify(execFile);
export type DeliverySnapshot = { evidenceClass: string; order: { id: string; status: string }; assignment: { id: string; version: number; status: string }; syntheticDestination: { latitude: string | null; longitude: string | null }; pod: { id: string; method: string; evidenceReference: string } | null; proof: Array<{ publicReference: string; usedAt: string | null; privateVisibility: boolean; status: string }>; commands: Array<{ operationId: string; type: string }>; attempts: Array<{ attemptNumber: number; retryable: boolean }>; locations: number; otps: Array<{ consumed: boolean; attempts: number }>; redeliveries: Array<{ status: string; publicReference: string }> };
export async function deliveryControl(reference: string, action = "snapshot") {
  assertDisposablePaystackAcceptance();
  const { stdout } = await execute(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/phase3-driver-delivery-control.ts", reference, action], { env: process.env, timeout: 45_000, maxBuffer: 1_000_000 });
  const prefix = action === "otp" ? "DISPOSABLE_DELIVERY_OTP " : "DRIVER_DELIVERY_SNAPSHOT ";
  const line = stdout.split(/\r?\n/).find(value => value.startsWith(prefix)); if (!line) throw new Error("Disposable delivery receipt unavailable.");
  return JSON.parse(line.slice(prefix.length));
}

/** DEVICE_GPS here is a browser fixture at a synthetic destination. This is
 * canonical offline engineering proof, never physical/device acceptance. */
export async function canonicalDriverDeliveryJourney(page: Page, suffix: string, width: number) {
  const f = await prepareStoreOrder(page, suffix, width);
  await login(page, "e2e-store@ktcouriers.local");
  for (const body of [{ action: "confirm-availability", orderLineId: f.baseline.lines[0].id, availableQuantity: 1 }, { action: "accept", preparationMinutes: 30, pickupInstructions: "Disposable synthetic pickup" }, { action: "start-preparation" }, { action: "mark-ready" }]) { const res = await storeAction(page, f.storeReference, body); expect(res.status(), await res.text()).toBe(200); }
  await completeSyntheticStoreHandoff(page, f.storeReference, suffix);
  const baseline = await deliveryControl(f.storeReference) as DeliverySnapshot;
  expect(baseline.order.status).toBe("PICKED_UP"); expect(baseline.pod).toBeNull(); expect(baseline.locations).toBe(0);
  const path = `/api/driver/assignments/${baseline.assignment.id}`;
  const post = async (stage: string, data: Record<string, unknown>) => page.request.post(`${path}/delivery/${stage}`, { data, headers: { origin: new URL(page.url()).origin } });
  const command = async () => ({ operationId: crypto.randomUUID(), assignmentVersion: (await deliveryControl(f.storeReference) as DeliverySnapshot).assignment.version });
  await login(page, "e2e-handoff-driver-foreign@ktcouriers.local"); expect((await post("start", await command())).status()).toBe(409); expect(await deliveryControl(f.storeReference)).toEqual(baseline);
  await login(page, "e2e-onboarding-390@ktcouriers.local"); expect((await post("start", await command())).status()).toBe(409); expect(await deliveryControl(f.storeReference)).toEqual(baseline);
  await login(page, `e2e-handoff-driver-${suffix}@ktcouriers.local`); await page.goto(`/driver/assignments/${baseline.assignment.id}`);
  await page.getByRole("button", { name: "Start Delivery", exact: true }).click();
  await page.context().setOffline(true); await page.getByRole("button", { name: "Confirm Start Delivery", exact: true }).click();
  await expect(page.getByText("Network error. Please try again.", { exact: true })).toBeVisible();
  expect(await deliveryControl(f.storeReference)).toEqual(baseline); await page.context().setOffline(false);
  await page.getByRole("button", { name: "Confirm Start Delivery", exact: true }).click();
  await expect.poll(async () => (await deliveryControl(f.storeReference)).order.status).toBe("IN_TRANSIT");
  const started = await deliveryControl(f.storeReference) as DeliverySnapshot;
  const attempt = { ...await command(), reason: "RECIPIENT_UNAVAILABLE", driverNote: "Disposable synthetic recipient-unavailable scenario; no physical attempt claimed." };
  const attempted = await post("attempt", attempt); expect(attempted.status(), await attempted.text()).toBe(200);
  expect((await post("attempt", attempt)).status()).toBe(200);
  const afterAttempt = await deliveryControl(f.storeReference) as DeliverySnapshot;
  expect(afterAttempt.order.status).toBe("DELIVERY_ATTEMPTED"); expect(afterAttempt.attempts).toEqual([expect.objectContaining({ attemptNumber: 1, retryable: true })]);
  await login(page, `e2e-paystack-${suffix}@ktcouriers.local`);
  const redeliveryBody = { operationId: `REDOP-${crypto.randomUUID().toUpperCase()}`, safeNote: "Disposable synthetic reschedule" };
  const redelivery = await page.request.post(`/api/orders/${started.order.id}/redelivery`, { data: redeliveryBody, headers: { origin: new URL(page.url()).origin } }); expect(redelivery.status(), await redelivery.text()).toBe(201);
  const request = (await redelivery.json()).data;
  const redeliveryReplay = await page.request.post(`/api/orders/${started.order.id}/redelivery`, { data: redeliveryBody, headers: { origin: new URL(page.url()).origin } }); expect(redeliveryReplay.status()).toBe(201); expect((await redeliveryReplay.json()).data.publicReference).toBe(request.publicReference);
  const redeliveryConflict = await page.request.post(`/api/orders/${started.order.id}/redelivery`, { data: { ...redeliveryBody, safeNote: "Different operation meaning" }, headers: { origin: new URL(page.url()).origin } }); expect(redeliveryConflict.status()).toBe(409);
  await login(page, "e2e-checkout-other@ktcouriers.local"); const foreignRedelivery = await page.request.post(`/api/orders/${started.order.id}/redelivery`, { data: redeliveryBody, headers: { origin: new URL(page.url()).origin } }); expect(foreignRedelivery.status()).toBe(400);

  await login(page, "superadmin@ktcouriers.local");
  const scheduleBody = { operationId: `REDOP-${crypto.randomUUID().toUpperCase()}`, expectedUpdatedAt: request.updatedAt, scheduledFor: new Date(Date.now() + 3_600_000).toISOString(), responsibilityCode: "DISPOSABLE_CUSTOMER_REQUEST" };
  const schedule = await page.request.post(`/api/admin/redelivery/${request.publicReference}/schedule`, { data: scheduleBody, headers: { origin: new URL(page.url()).origin } }); expect(schedule.status(), await schedule.text()).toBe(200);
  const scheduleReplay = await page.request.post(`/api/admin/redelivery/${request.publicReference}/schedule`, { data: scheduleBody, headers: { origin: new URL(page.url()).origin } }); expect(scheduleReplay.status()).toBe(200);
  const scheduleConflict = await page.request.post(`/api/admin/redelivery/${request.publicReference}/schedule`, { data: { ...scheduleBody, responsibilityCode: "DIFFERENT_RESPONSIBILITY" }, headers: { origin: new URL(page.url()).origin } }); expect(scheduleConflict.status()).toBe(409);
  expect((await deliveryControl(f.storeReference) as DeliverySnapshot).redeliveries[0].status).toBe("SCHEDULED");
  await login(page, `e2e-handoff-driver-${suffix}@ktcouriers.local`); await page.goto(`/driver/assignments/${baseline.assignment.id}`);
  await page.getByRole("button", { name: "Resume Delivery", exact: true }).click(); await page.getByRole("button", { name: "Confirm Start Delivery", exact: true }).click();
  await expect.poll(async () => (await deliveryControl(f.storeReference)).order.status).toBe("IN_TRANSIT");
  await page.reload();
  await page.getByRole("button", { name: "Confirm safety check", exact: true }).click(); await expect(page.getByRole("status").filter({ hasText: "Safety check recorded" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm lawful transport", exact: true }).click(); await expect(page.getByRole("status").filter({ hasText: "Lawful transport confirmation recorded" })).toBeVisible();
  const image = await sharp({ create: { width: 48, height: 32, channels: 3, background: "#227799" } }).png().toBuffer();
  await page.getByLabel("Private delivery proof image", { exact: true }).setInputFiles({ name: "disposable-synthetic-pod.png", mimeType: "image/png", buffer: image });
  const uploadedPromise = page.waitForResponse(response => response.url().endsWith("/delivery/proof") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Upload private delivery proof", exact: true }).click();
  const uploaded = await uploadedPromise; expect(uploaded.status(), await uploaded.text()).toBe(201); const proof = await uploaded.json(); expect(proof.evidenceReference).toMatch(/^dpod_/);
  await page.getByRole("button", { name: "Send OTP to Recipient", exact: true }).click();
  const sentPromise = page.waitForResponse(response => response.url().endsWith("/delivery/otp") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Send OTP Now", exact: true }).click();
  const sent = await sentPromise; expect(sent.status(), await sent.text()).toBe(200);
  expect(JSON.stringify(await sent.json())).not.toContain("plainCode"); const otpBody = sent.request().postDataJSON();
  const otp = (await deliveryControl(f.storeReference, "otp")).code as string;
  const completion = { ...await command(), otpCode: otp, recipientName: "Disposable synthetic recipient", driverNote: "Disposable synthetic offline POD; no physical delivery claim", evidenceReference: proof.evidenceReference, confirmDelivery: true };
  const beforeWrong = await deliveryControl(f.storeReference) as DeliverySnapshot;
  const wrong = await post("complete", { ...completion, operationId: crypto.randomUUID(), otpCode: otp === "000000" ? "111111" : "000000" });
  expect(wrong.status()).toBe(409);
  const rejectedOtp = await deliveryControl(f.storeReference) as DeliverySnapshot;
  expect(rejectedOtp.otps[0].attempts).toBe(beforeWrong.otps[0].attempts + 1);
  expect(rejectedOtp.otps[0].consumed).toBe(false); expect(rejectedOtp.order.status).toBe("IN_TRANSIT"); expect(rejectedOtp.pod).toBeNull();
  const beforeLocation = await deliveryControl(f.storeReference) as DeliverySnapshot;
  const missingLocation = await post("complete", completion); expect(missingLocation.status(), await missingLocation.text()).toBe(409); expect(await deliveryControl(f.storeReference)).toEqual(beforeLocation);
  await page.getByRole("button", { name: "Record Location", exact: true }).click();
  await expect(page.getByText("Location permission is required to record a location sample.", { exact: true })).toBeVisible(); expect((await deliveryControl(f.storeReference)).locations).toBe(0);
  await login(page, "e2e-handoff-driver-foreign@ktcouriers.local");
  expect((await post("otp", otpBody)).status()).toBe(409);
  expect((await page.request.get(`/api/private-media/${proof.mediaReference}`)).status()).toBe(403);
  const foreignUpload = await page.request.post(`${path}/delivery/proof`, { multipart: { assignmentVersion: String(beforeLocation.assignment.version), file: { name: "foreign.png", mimeType: "image/png", buffer: image } }, headers: { origin: new URL(page.url()).origin } }); expect(foreignUpload.status()).toBe(409);
  expect(await deliveryControl(f.storeReference)).toEqual(beforeLocation);
  await login(page, `e2e-handoff-driver-${suffix}@ktcouriers.local`); await page.goto(`/driver/assignments/${baseline.assignment.id}`);
  const destination = beforeLocation.syntheticDestination;
  if (!destination?.latitude || !destination.longitude) throw new Error("Reviewed disposable geocoded destination is required for synthetic DEVICE_GPS browser evidence.");
  await page.context().setGeolocation({ latitude: Number(destination.latitude), longitude: Number(destination.longitude), accuracy: 5 });
  await page.context().grantPermissions(["geolocation"]);
  await page.getByRole("button", { name: "Record Location", exact: true }).click(); await expect(page.getByRole("status").filter({ hasText: "Verified location recorded." })).toBeVisible();
  const finalCommand = { ...completion, ...await command() };
  const results = await Promise.all([post("complete", finalCommand), post("complete", finalCommand)]); for (const completed of results) expect(completed.status(), await completed.text()).toBe(200);
  const final = await deliveryControl(f.storeReference) as DeliverySnapshot;
  expect(final.order.status).toBe("DELIVERED"); expect(final.assignment.status).toBe("COMPLETED"); expect(final.pod).toMatchObject({ method: "OTP", evidenceReference: proof.evidenceReference });
  expect(final.proof[0].usedAt).not.toBeNull(); expect(final.otps[0].consumed).toBe(true); expect(final.commands.filter(row => row.type === "DELIVERY_COMPLETE")).toHaveLength(1);
  expect((await post("complete", finalCommand)).status()).toBe(200); expect(await deliveryControl(f.storeReference)).toEqual(final);
  const store = await storeControl(f.storeReference); expect(store.deliveryBridgeStatus).toBe("DELIVERED"); expect(store.payment).toEqual(f.baseline.payment);
  return { evidenceClass: "SYNTHETIC_BROWSER_DEVICE_GPS_AND_RASTER_NOT_T5", baseline, afterAttempt, beforeLocation, final, store };
}
