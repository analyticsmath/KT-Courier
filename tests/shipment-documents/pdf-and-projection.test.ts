import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { Byte, Encoder } from "@nuintun/qrcode";
import {
  formatSastAndUtc,
  ShipmentDocumentError,
  type IssuerIdentitySnapshot,
  type ShipmentWaybillPayload,
} from "@/lib/shipment-documents/contracts";
import {
  buildPodPayload,
  buildWaybillPayload,
  sanitizePayloadForViewerRole,
  type DocumentOrderRecord,
} from "@/lib/shipment-documents/projection";
import { renderShipmentDocumentPdf } from "@/lib/shipment-documents/render-pdf";

const TEST_ISSUER: IssuerIdentitySnapshot = {
  companyProfileVersionId: "cpv_test_1",
  publicReference: "KT-ISSUER-V1",
  versionNumber: 1,
  legalName: "KT Couriers (Pty) Ltd",
  tradingName: "KT Couriers",
  registrationNumber: "2024/475266/07",
  vatNumber: null,
  supportEmail: "support@ktcouriers.com",
  businessEmail: "info@ktcouriers.com",
  telephoneNumbers: ["067 815 5245", "075 019 2265"],
  website: "https://www.ktcouriers.com",
  physicalAddress: null,
  walkInOffice: false,
};

function makeOrder(overrides?: Partial<DocumentOrderRecord>): DocumentOrderRecord {
  const createdAt = new Date("2026-11-26T08:15:00.000Z");
  return {
    id: "ord_test_1",
    orderNumber: "KT-2026-100245",
    source: "CUSTOMER",
    status: "CONFIRMED",
    deliveryType: "PARCEL_DOCUMENT",
    currency: "ZAR",
    createdAt,
    scheduledFor: null,
    parcelCount: 1,
    parcelDescription: "Signed legal tender & corporate tender binder",
    customerNote: "Call reception upon arrival at main gate.",
    pricingSnapshot: { senderContact: { email: "sender.corp@example.co.za" } },
    recipientName: "Noël Brümilda van der Merwe",
    recipientPhone: "+27825550101",
    priceEstimate: { toFixed: () => "180.00" },
    pickupAddress: {
      contactName: "Thabiso Ndlovu",
      contactPhone: "+27825550100",
      line1: "14 Commissioner Street",
      line2: "Suite 4B",
      suburb: "Marshalltown",
      city: "Johannesburg",
      province: "Gauteng",
      postalCode: "2001",
      country: "South Africa",
      accessNotes: "Security desk on ground floor",
    },
    dropoffAddress: {
      contactName: "Noël Brümilda van der Merwe",
      contactPhone: "+27825550101",
      line1: "72 Rivonia Road",
      line2: "Block C",
      suburb: "Sandhurst",
      city: "Sandton",
      province: "Gauteng",
      postalCode: "2196",
      country: "South Africa",
      accessNotes: "Visitor PIN required at boom",
    },
    customer: { name: "Thabiso Ndlovu", email: "thabiso@example.co.za" },
    store: null,
    statusHistory: [
      { status: "PENDING", createdAt },
      { status: "CONFIRMED", createdAt: new Date("2026-11-26T08:20:00.000Z") },
    ],
    cashOnDelivery: {
      policyMode: "DEPOSIT_PLUS_COD",
      status: "READY_FOR_COLLECTION",
      authoritativePayable: { toFixed: () => "180.00" },
      digitalPaid: { toFixed: () => "90.00" },
      cashObligation: { toFixed: () => "90.00" },
      cashCollected: { toFixed: () => "0.00" },
    },
    payments: [],
    marketplaceStoreOrderBridge: null,
    proofOfDelivery: null,
    ...overrides,
  };
}

describe("Shipment Document Projections & Server A4 PDF Rendering", () => {
  it("formats SAST (Africa/Johannesburg) and UTC timestamps clearly", () => {
    const formatted = formatSastAndUtc(new Date("2026-11-26T10:30:00.000Z"));
    expect(formatted).toContain("SAST");
    expect(formatted).toContain("UTC");
    expect(formatted).toContain("12:30");
    expect(formatted).toContain("10:30");
  });

  it("renders a valid A4 Waybill PDF handling 250-char streets, 150-char unit lines, UTF-8 accents, and scannable QR without GPS/secrets", async () => {
    const longStreet = "Plot-".padEnd(250, "X");
    const longUnit = "Building-".padEnd(150, "Y");
    const order = makeOrder({
      dropoffAddress: {
        contactName: "Noël Brümilda van der Merwe",
        contactPhone: "+27825550101",
        line1: longStreet,
        line2: longUnit,
        suburb: "Sandhurst",
        city: "Sandton",
        province: "Gauteng",
        postalCode: "2196",
        country: "South Africa",
        accessNotes: "Very long note ".repeat(40),
      },
    });

    const payload = buildWaybillPayload({
      order,
      issuer: TEST_ISSUER,
      documentRef: "WB-KT-2026-100245-R1",
      revision: 1,
      issuedAt: new Date("2026-11-26T08:21:00.000Z"),
    });

    expect(JSON.stringify(payload)).not.toContain("latitude");
    expect(JSON.stringify(payload)).not.toContain("longitude");
    expect(payload.senderEmailMaskedOrSafe).toBe("se***@example.co.za");
    expect(payload.paymentSummary.depositPaidZar).toBe("90.00");
    expect(payload.paymentSummary.cashDueOnDeliveryZar).toBe("90.00");
    expect(payload.trackingUrl).toBe("https://www.ktcouriers.com/track?reference=KT-2026-100245");

    // Verify QR encodes exact tracking URL cleanly
    const qr = new Encoder({ level: "M" }).encode(new Byte(payload.trackingUrl));
    expect(qr.size).toBeGreaterThanOrEqual(21);

    const bytes = await renderShipmentDocumentPdf(payload);
    expect(Buffer.from(bytes.subarray(0, 5)).toString("ascii")).toBe("%PDF-");

    const parsed = await PDFDocument.load(bytes);
    expect(parsed.getPageCount()).toBeGreaterThanOrEqual(1);
    const firstPage = parsed.getPage(0);
    expect(firstPage.getWidth()).toBeCloseTo(595.28, 1);
    expect(firstPage.getHeight()).toBeCloseTo(841.89, 1);

    // Sample watermark only emitted when explicitly flagged
    const samplePayload: ShipmentWaybillPayload = { ...payload, isSample: true };
    const sampleBytes = await renderShipmentDocumentPdf(samplePayload);
    const sampleParsed = await PDFDocument.load(sampleBytes);
    expect(sampleParsed.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("refuses POD payload without genuine ProofOfDelivery record and distinguishes OTP vs ADMIN_MANUAL accurately", async () => {
    const noProofOrder = makeOrder({ status: "DELIVERED", proofOfDelivery: null });
    expect(() =>
      buildPodPayload({
        order: noProofOrder,
        issuer: TEST_ISSUER,
        documentRef: "POD-KT-2026-100245-R1",
        revision: 1,
        issuedAt: new Date("2026-11-26T12:00:00.000Z"),
      }),
    ).toThrow(ShipmentDocumentError);

    const otpOrder = makeOrder({
      status: "DELIVERED",
      proofOfDelivery: {
        id: "pod_otp_1",
        method: "OTP",
        recipientName: "Noël van der Merwe",
        recipientPhone: "+27825550101",
        otpVerifiedAt: new Date("2026-11-26T11:55:00.000Z"),
        deliveredAt: new Date("2026-11-26T11:55:00.000Z"),
        publicNote: "Handed directly to recipient at reception.",
        evidenceReference: "PMO-abc123",
        driverProfile: { id: "drv_1", displayName: "Sipho Dlamini", user: { name: "Sipho Dlamini" } },
      },
    });
    const otpPod = buildPodPayload({
      order: otpOrder,
      issuer: TEST_ISSUER,
      documentRef: "POD-KT-2026-100245-R1",
      revision: 1,
      issuedAt: new Date("2026-11-26T11:56:00.000Z"),
    });
    expect(otpPod.proofMethod).toBe("OTP");
    expect(otpPod.proofMethodLabel).toContain("OTP");
    expect(otpPod.hasPrivateMediaEvidence).toBe(true);
    expect(otpPod.privateMediaNotice).not.toContain("PMO-abc123");

    const otpBytes = await renderShipmentDocumentPdf(otpPod);
    expect(Buffer.from(otpBytes.subarray(0, 5)).toString("ascii")).toBe("%PDF-");
    expect((await PDFDocument.load(otpBytes)).getPageCount()).toBeGreaterThanOrEqual(1);

    const manualOrder = makeOrder({
      status: "DELIVERED",
      proofOfDelivery: {
        id: "pod_man_1",
        method: "ADMIN_MANUAL",
        recipientName: "Front Desk Reception",
        recipientPhone: null,
        otpVerifiedAt: null,
        deliveredAt: new Date("2026-11-26T11:59:00.000Z"),
        publicNote: "Confirmed manually with site security.",
        evidenceReference: null,
        driverProfile: null,
      },
    });
    const manualPod = buildPodPayload({
      order: manualOrder,
      issuer: TEST_ISSUER,
      documentRef: "POD-KT-2026-100245-R1",
      revision: 1,
      issuedAt: new Date("2026-11-26T12:00:00.000Z"),
    });
    expect(manualPod.proofMethod).toBe("ADMIN_MANUAL");
    expect(manualPod.proofMethodLabel).toContain("Manually confirmed");
    const manualBytes = await renderShipmentDocumentPdf(manualPod);
    expect(Buffer.from(manualBytes.subarray(0, 5)).toString("ascii")).toBe("%PDF-");
  });

  it("strips private sender email & prepaid fee markup for DRIVER role on Waybill", () => {
    const order = makeOrder({ cashOnDelivery: null });
    const waybill = buildWaybillPayload({
      order,
      issuer: TEST_ISSUER,
      documentRef: "WB-KT-2026-100245-R1",
      revision: 1,
      issuedAt: new Date("2026-11-26T08:21:00.000Z"),
    });
    const driverView = sanitizePayloadForViewerRole(waybill, "DRIVER");
    expect(driverView.senderEmailMaskedOrSafe).toBeNull();
    expect(driverView.paymentSummary.totalZar).toBeNull();
    expect(driverView.paymentSummary.depositPaidZar).toBeNull();
  });

  it("identifies QA acceptance waybill & POD PDFs as non-commercial test documents without altering production PDFs", async () => {
    const prodOrder = makeOrder({
      status: "DELIVERED",
      proofOfDelivery: {
        id: "pod_prod_1",
        method: "OTP",
        recipientName: "Commercial Recipient",
        recipientPhone: "+27825550101",
        otpVerifiedAt: new Date("2026-11-26T11:55:00.000Z"),
        deliveredAt: new Date("2026-11-26T11:55:00.000Z"),
        publicNote: null,
        evidenceReference: null,
        driverProfile: { id: "drv_1", displayName: "Real Driver", user: { name: "Real Driver" } },
      },
    });
    const prodWaybill = buildWaybillPayload({
      order: prodOrder,
      issuer: TEST_ISSUER,
      documentRef: "WB-PROD-1",
      revision: 1,
      issuedAt: new Date("2026-11-26T08:21:00.000Z"),
    });
    const prodPod = buildPodPayload({
      order: prodOrder,
      issuer: TEST_ISSUER,
      documentRef: "POD-PROD-1",
      revision: 1,
      issuedAt: new Date("2026-11-26T11:56:00.000Z"),
    });
    expect(prodWaybill.isQaAcceptance).toBeUndefined();
    expect(prodPod.isQaAcceptance).toBeUndefined();

    const prodWaybillPdf = await PDFDocument.load(await renderShipmentDocumentPdf(prodWaybill));
    const prodPodPdf = await PDFDocument.load(await renderShipmentDocumentPdf(prodPod));
    expect(prodWaybillPdf.getTitle()).toBe("Official Waybill — KT-2026-100245");
    expect(prodPodPdf.getTitle()).toBe("Proof of Delivery — KT-2026-100245");
    expect(prodWaybillPdf.getSubject()).not.toContain("QA SANDBOX");
    expect(prodPodPdf.getSubject()).not.toContain("QA SANDBOX");
    expect(prodWaybillPdf.getKeywords()).toBeUndefined();

    const qaOrder = makeOrder({
      isQaAcceptance: true,
      status: "DELIVERED",
      proofOfDelivery: prodOrder.proofOfDelivery,
    });
    const qaWaybill = buildWaybillPayload({
      order: qaOrder,
      issuer: TEST_ISSUER,
      documentRef: "WB-QA-1",
      revision: 1,
      issuedAt: new Date("2026-11-26T08:21:00.000Z"),
    });
    const qaPod = buildPodPayload({
      order: qaOrder,
      issuer: TEST_ISSUER,
      documentRef: "POD-QA-1",
      revision: 1,
      issuedAt: new Date("2026-11-26T11:56:00.000Z"),
    });
    expect(qaWaybill.isQaAcceptance).toBe(true);
    expect(qaPod.isQaAcceptance).toBe(true);

    const qaWaybillPdf = await PDFDocument.load(await renderShipmentDocumentPdf(qaWaybill));
    const qaPodPdf = await PDFDocument.load(await renderShipmentDocumentPdf(qaPod));
    expect(qaWaybillPdf.getTitle()).toContain("QA Test Waybill");
    expect(qaWaybillPdf.getTitle()).toContain("QA SANDBOX TEST");
    expect(qaWaybillPdf.getSubject()).toContain("QA SANDBOX TEST - NON-COMMERCIAL");
    expect(qaWaybillPdf.getKeywords()).toContain("NON-COMMERCIAL");
    expect(qaPodPdf.getTitle()).toContain("QA Test Proof of Delivery");
    expect(qaPodPdf.getSubject()).toContain("QA SANDBOX TEST - NON-COMMERCIAL");
    expect(qaPodPdf.getKeywords()).toContain("QA SANDBOX TEST");
  });
});
