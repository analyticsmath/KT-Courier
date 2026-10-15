import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DriverDetailDto } from "@/lib/dto/driver.dto";

const db = vi.hoisted(() => ({
  driverProfile: { findUnique: vi.fn() },
  privateMediaObject: { findFirst: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));

import { getDriverDetail } from "@/lib/services/admin-drivers.service";
import { DriverDetailsConsole } from "@/components/admin/DriverDetailsConsole";

const media = (reference: string) => ({
  publicReference: reference, originalFileName: `${reference}.pdf`,
  detectedMimeType: "application/pdf", status: "READY", storageKey: "must-remain-private",
});
const document = (id: string, documentType: string, reference: string) => ({
  id, documentType, status: "SUBMITTED", expiresAt: null, reviewedAt: null,
  rejectionReason: null as string | null, fileName: `${reference}.pdf`, privateMediaObject: media(reference) as ReturnType<typeof media> | null,
});
function driverRow() {
  return {
    id: "driver", driverCode: "DRV-1", displayName: "New Driver", status: "PENDING_REVIEW",
    onboardingStatus: "PENDING_REVIEW", availability: "OFFLINE", serviceRegions: [],
    user: { id: "user", email: "driver@example.test", role: "DRIVER", status: "ACTIVE" },
    documents: [document("identity", "ID_DOCUMENT", "identity-ref"), document("licence", "LICENSE", "licence-ref")],
    vehicles: [{
      id: "vehicle", publicReference: "VEH-1", make: "Make", model: "Model", registrationNumber: "ABC123",
      vehicleType: "MOTORCYCLE", status: "PENDING_REVIEW", media: [],
      documents: [document("registration", "REGISTRATION", "registration-ref"), document("disc", "LICENCE_DISC", "disc-ref"), document("insurance", "INSURANCE", "insurance-ref")],
    }],
  };
}

describe("administrator document review", () => {
  it("carries only safe document media metadata from persistence to the review links", async () => {
    db.driverProfile.findUnique.mockResolvedValue(driverRow());
    db.privateMediaObject.findFirst.mockResolvedValue(null);
    const driver = await getDriverDetail("driver");
    expect(driver?.documents[0]).toMatchObject({ privateMediaObject: {
      publicReference: "identity-ref", originalFileName: "identity-ref.pdf", detectedMimeType: "application/pdf", status: "READY",
    } });
    expect(driver?.vehicles?.[0].documents[0]).toMatchObject({ privateMediaObject: { publicReference: "registration-ref" } });
    expect(JSON.stringify(driver)).not.toContain("must-remain-private");
    const html = renderToStaticMarkup(createElement(DriverDetailsConsole, { initialDriver: driver!, allRegions: [], activityLogs: [] }));
    for (const reference of ["identity-ref", "licence-ref", "registration-ref", "disc-ref", "insurance-ref"]) {
      expect(html).toContain(`href="/api/private-media/${reference}"`);
    }
  });

  it("opens fresh vehicle evidence after a replacement and does not offer the superseded file for review", () => {
    const row = driverRow();
    const old = { ...document("old", "REGISTRATION", "superseded-ref"), status: "REJECTED", rejectionReason: "SUPERSEDED_BY_NEW_UPLOAD" };
    row.vehicles[0].documents.unshift(old);
    const html = renderToStaticMarkup(createElement(DriverDetailsConsole, { initialDriver: row as unknown as DriverDetailDto, allRegions: [], activityLogs: [] }));
    expect(html).toContain('href="/api/private-media/registration-ref"');
    expect(html).not.toContain('href="/api/private-media/superseded-ref"');
  });

  it("retains review controls for legacy documents without uploaded private media", () => {
    const row = driverRow();
    row.documents[0].privateMediaObject = null;
    const html = renderToStaticMarkup(createElement(DriverDetailsConsole, { initialDriver: row as unknown as DriverDetailDto, allRegions: [], activityLogs: [] }));
    expect(html).toContain("No uploaded document available");
    expect(html).not.toContain('/api/private-media/undefined');
    expect(html).toContain("Approve");
  });
});
