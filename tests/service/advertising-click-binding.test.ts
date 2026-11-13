import { expect, it, vi } from "vitest";
const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/advertising/measurement.service", () => ({ AdvertisingMeasurementService: class { trackEvent = track; } }));
import { AdvertisingClickService, safeAdvertisingDestination } from "@/lib/advertising/click.service";
const payload = { serveDecisionId: "public-serve", campaignVersionId: "version", placementCode: "placement", sponsoredObjectType: "STORE", sponsoredObjectId: "store", sessionFingerprint: "session", issuedAt: 1, expiresAt: 9999999999999, destinationReference: "/shop" };
const decision = { id: "internal-serve", campaignVersionId: "version", placementDefinitionId: "internal-placement", sessionFingerprint: "session", placementDefinition: { code: "placement" }, campaignVersion: { creativeSnapshots: [{ destinationReference: "/shop?sort=new" }] } };
it("rejects external, protocol-relative and browser-normalized off-site destinations", () => {
  for (const destination of ["//evil.example/path", "/\\evil.example", "https://evil.example", "/\n/evil.example"]) expect(safeAdvertisingDestination(destination)).toBeNull();
  expect(safeAdvertisingDestination("/shop?sort=new#top")).toBe("/shop?sort=new#top");
});
it("records foreign-key IDs from the bound serve decision", async () => {
  track.mockReset().mockResolvedValue({ id: "event" });
  const tx = { advertisingServeDecision: { findUnique: vi.fn().mockResolvedValue(decision) }, advertisingMeasurementEvent: { update: vi.fn().mockResolvedValue({}) } };
  const service = new AdvertisingClickService(tx as never);
  vi.spyOn(service, "classifyClick").mockResolvedValue({ validity: "VALID", classification: "VALID_NON_BILLABLE" });
  expect(await service.processClick(payload, "session")).toEqual({ destination: "/shop?sort=new" });
  expect(track).toHaveBeenCalledWith(expect.objectContaining({ serveDecisionId: "internal-serve", placementDefinitionId: "internal-placement", campaignVersionId: "version" }));
});
it("rejects a token bound to a different placement or session before recording", async () => {
  track.mockReset();
  const service = new AdvertisingClickService({ advertisingServeDecision: { findUnique: vi.fn().mockResolvedValue(decision) } } as never);
  await expect(service.processClick({ ...payload, placementCode: "foreign" }, "session")).rejects.toThrow();
  await expect(service.processClick(payload, "different-session")).rejects.toThrow();
  expect(track).not.toHaveBeenCalled();
});
