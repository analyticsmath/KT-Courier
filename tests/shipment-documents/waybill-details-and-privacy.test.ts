import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  buildPodPayload,
  buildWaybillPayload,
  type DocumentOrderRecord,
} from "@/lib/shipment-documents/projection";
import { renderShipmentDocumentPdf } from "@/lib/shipment-documents/render-pdf";
import type { IssuerIdentitySnapshot } from "@/lib/shipment-documents/contracts";

const SAMPLE_ISSUER: IssuerIdentitySnapshot = {
  companyProfileVersionId: "cpv_test_1",
  publicReference: "cpv-0001",
  versionNumber: 1,
  legalName: "KT Couriers (Pty) Ltd",
  tradingName: "KT Couriers",
  registrationNumber: "2026/001234/07",
  vatNumber: null,
  physicalAddress: "14 Commissioner Street, Marshalltown, Johannesburg, 2001",
  supportEmail: "support@ktcouriers.com",
  businessEmail: "ops@ktcouriers.com",
  telephoneNumbers: ["+27 11 555 0100"],
  website: "https://www.ktcouriers.com",
  walkInOffice: true,
};

describe("Waybill & POD metadata fidelity and access-note redaction", () => {
  it("excludes private gate PINs/accessNotes while preserving parcel class limit distinct from actual weight", async () => {
    const order: DocumentOrderRecord = {
      id: "ord_test_privacy_1",
      orderNumber: "KT-2026-998811",
      source: "CUSTOMER",
      status: "CONFIRMED",
      deliveryType: "PARCEL_DOCUMENT",
      currency: "ZAR",
      createdAt: new Date("2026-11-26T09:00:00.000Z"),
      scheduledFor: null,
      parcelCount: 1,
      parcelDescription: "Medical diagnostic kit",
      customerNote: "Handle upright",
      distanceMeters: 18_450,
      pricingSnapshot: {
        serviceName: "Express Courier",
        senderContact: { email: "ops.client@example.co.za" },
        input: {
          actualWeightKg: "1.8",
          lengthCm: "30",
          widthCm: "20",
          heightCm: "15",
        },
        rule: {
          parcelSize: "MEDIUM",
          serviceKey: "express-courier",
          tariff: {
            maximumWeightKg: 10,
          },
        },
      },
      recipientName: "Thabo Mokoena",
      recipientPhone: "+27820001122",
      priceEstimate: { toFixed: (d) => (210).toFixed(d) },
      pickupAddress: {
        contactName: "Dispatch Desk",
        contactPhone: "+27110001111",
        line1: "45 Maude Street",
        line2: null,
        suburb: "Sandown",
        city: "Sandton",
        province: "Gauteng",
        postalCode: "2196",
        country: "South Africa",
        accessNotes: "SECRET GATE PIN 9911#",
      },
      dropoffAddress: {
        contactName: "Thabo Mokoena",
        contactPhone: "+27820001122",
        line1: "120 Bree Street",
        line2: "Unit 4B",
        suburb: "City Centre",
        city: "Cape Town",
        province: "Western Cape",
        postalCode: "8001",
        country: "South Africa",
        accessNotes: "Private boom code 4455*",
      },
      customer: { name: "Clinic Logistics", email: "ops.client@example.co.za" },
      store: null,
      statusHistory: [{ status: "CONFIRMED", createdAt: new Date("2026-11-26T09:05:00.000Z") }],
      cashOnDelivery: null,
      payments: [],
      marketplaceStoreOrderBridge: null,
      proofOfDelivery: {
        id: "pod_priv_1",
        method: "OTP",
        recipientName: "Thabo Mokoena",
        recipientPhone: "+27820001122",
        otpVerifiedAt: new Date("2026-11-26T12:00:00.000Z"),
        deliveredAt: new Date("2026-11-26T12:00:00.000Z"),
        publicNote: "Delivered at reception",
        evidenceReference: null,
        driverProfile: { id: "drv_1", displayName: "Sipho Dlamini", user: null },
      },
    };

    const waybill = buildWaybillPayload({
      order,
      issuer: SAMPLE_ISSUER,
      documentRef: "WB-KT-2026-998811-R1",
      revision: 1,
      issuedAt: new Date("2026-11-26T09:05:00.000Z"),
    });

    expect(waybill.serviceName).toBe("Express Courier");
    expect(waybill.parcelSize).toBe("MEDIUM");
    expect(waybill.actualWeightKg).toBe("1.8");
    expect(waybill.parcelClassMaxWeightKg).toBe("10");
    expect(waybill.dimensionsCm).toBe("30 x 20 x 15 cm");
    expect(waybill.routeDistanceKm).toBe("18.5");

    const serializedWaybill = JSON.stringify(waybill);
    expect(serializedWaybill).not.toContain("SECRET GATE PIN 9911#");
    expect(serializedWaybill).not.toContain("Private boom code 4455*");

    const pod = buildPodPayload({
      order,
      issuer: SAMPLE_ISSUER,
      documentRef: "POD-KT-2026-998811-R1",
      revision: 1,
      issuedAt: new Date("2026-11-26T12:00:00.000Z"),
    });
    expect(JSON.stringify(pod)).not.toContain("Private boom code 4455*");

    const wbPdf = await renderShipmentDocumentPdf(waybill);
    const podPdf = await renderShipmentDocumentPdf(pod);
    expect((await PDFDocument.load(wbPdf)).getPageCount()).toBeGreaterThanOrEqual(1);
    expect((await PDFDocument.load(podPdf)).getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("never substitutes class weight limit when actualWeightKg is omitted", () => {
    const order: DocumentOrderRecord = {
      id: "ord_no_weight",
      orderNumber: "KT-2026-998812",
      source: "CUSTOMER",
      status: "CONFIRMED",
      deliveryType: "PARCEL_DOCUMENT",
      currency: "ZAR",
      createdAt: new Date("2026-11-26T09:00:00.000Z"),
      scheduledFor: null,
      parcelCount: 1,
      parcelDescription: null,
      customerNote: null,
      distanceMeters: null,
      pricingSnapshot: {
        rule: {
          parcelSize: "SMALL",
          tariff: { maximumWeightKg: 5 },
        },
      },
      recipientName: "Jane",
      recipientPhone: "+27821112233",
      priceEstimate: { toFixed: (d) => (95).toFixed(d) },
      pickupAddress: null,
      dropoffAddress: null,
      customer: null,
      store: null,
      statusHistory: [],
      cashOnDelivery: null,
      payments: [],
      marketplaceStoreOrderBridge: null,
      proofOfDelivery: null,
    };

    const waybill = buildWaybillPayload({
      order,
      issuer: SAMPLE_ISSUER,
      documentRef: "WB-KT-2026-998812-R1",
      revision: 1,
      issuedAt: new Date("2026-11-26T09:05:00.000Z"),
    });
    expect(waybill.actualWeightKg).toBeNull();
    expect(waybill.parcelClassMaxWeightKg).toBe("5");
  });
});
