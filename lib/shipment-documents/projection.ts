import { createHash } from "node:crypto";
import {
  canonicalTrackingUrl,
  formatSastAndUtc,
  ShipmentDocumentError,
  type IssuerIdentitySnapshot,
  type ShipmentAddressSnapshot,
  type ShipmentDocumentViewerRole,
  type ShipmentPodPayload,
  type ShipmentWaybillPayload,
} from "./contracts";

export function canonicalJsonStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJsonStringify(item)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((key) => obj[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJsonStringify(obj[key])}`).join(",")}}`;
}

export function computePayloadSha256(payload: unknown): string {
  return createHash("sha256").update(canonicalJsonStringify(payload)).digest("hex");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function parseTelephoneNumbers(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((entry) => String(entry ?? "").trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((entry) => String(entry ?? "").trim()).filter(Boolean);
        }
      } catch {
        // treat as plain delimited phone text
      }
    }
    return trimmed
      .split(/[,;/]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (raw && typeof raw === "object") {
    return Object.values(raw as Record<string, unknown>)
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
  }
  return [];
}

function formatPhysicalAddressObject(raw: unknown): string | null {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed || null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const parts = ["line1", "line2", "suburb", "city", "province", "postalCode", "country", "formattedAddress"]
    .map((key) => (typeof obj[key] === "string" ? obj[key].trim() : ""))
    .filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  const fallback = Object.values(obj)
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  return fallback.length ? fallback.join(", ") : null;
}

export function extractIssuerSnapshot(
  issuerSnapshotRow: { companyProfileVersionId: string; issuerSnapshot: unknown },
): IssuerIdentitySnapshot {
  const raw = asRecord(issuerSnapshotRow.issuerSnapshot);
  const meta = asRecord(raw.documentIdentityMetadata);
  const legalName = typeof raw.legalName === "string" && raw.legalName.trim() ? raw.legalName.trim() : "KT Couriers";
  const tradingName = typeof raw.tradingName === "string" && raw.tradingName.trim() ? raw.tradingName.trim() : null;
  const supportEmail = typeof raw.supportEmail === "string" && raw.supportEmail.trim() ? raw.supportEmail.trim() : null;
  const website =
    typeof raw.website === "string" && raw.website.trim()
      ? raw.website.trim()
      : "https://www.ktcouriers.com";

  if (!legalName) {
    throw new ShipmentDocumentError(
      "DOCUMENT_INTEGRITY_ERROR",
      500,
      "Captured company issuer snapshot is incomplete.",
    );
  }

  return {
    companyProfileVersionId: issuerSnapshotRow.companyProfileVersionId,
    publicReference: typeof raw.publicReference === "string" ? raw.publicReference : null,
    versionNumber: typeof raw.versionNumber === "number" ? raw.versionNumber : 1,
    legalName,
    tradingName,
    registrationNumber: typeof raw.registrationNumber === "string" ? raw.registrationNumber : null,
    vatNumber: typeof raw.vatNumber === "string" ? raw.vatNumber : null,
    supportEmail,
    businessEmail: typeof raw.businessEmail === "string" ? raw.businessEmail : null,
    telephoneNumbers: parseTelephoneNumbers(raw.telephoneNumbers),
    website,
    physicalAddress: formatPhysicalAddressObject(raw.physicalAddress),
    walkInOffice: meta.walkInOffice === true,
  };
}

export function formatDeliveryTypeLabel(deliveryType: string): string {
  switch (deliveryType) {
    case "SAME_DAY":
      return "Same-Day Courier";
    case "SCHEDULED":
      return "Scheduled Delivery";
    case "BUSINESS":
      return "Business Courier";
    case "PARCEL_DOCUMENT":
      return "Parcel & Document";
    default:
      return deliveryType.replaceAll("_", " ");
  }
}

export function formatOrderStatusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Awaiting Confirmation";
    case "CONFIRMED":
      return "Confirmed · Ready for Dispatch";
    case "DISPATCHED":
    case "DRIVER_ASSIGNED":
      return "Driver Assigned";
    case "PICKED_UP":
      return "Collected";
    case "IN_TRANSIT":
      return "In Transit";
    case "DELIVERY_ATTEMPTED":
      return "Delivery Attempted";
    case "DELIVERED":
      return "Delivered";
    case "COMPLETED":
      return "Completed";
    case "DELIVERY_FAILED":
      return "Delivery Exception";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status.replaceAll("_", " ");
  }
}

function projectSafeAddress(
  address: {
    contactName: string | null;
    contactPhone: string | null;
    line1: string;
    line2: string | null;
    suburb: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    country: string;
    accessNotes: string | null;
  } | null | undefined,
): ShipmentAddressSnapshot | null {
  if (!address) return null;
  // Strictly omit GPS coordinates (latitude/longitude) and placeId from immutable document snapshots.
  return {
    contactName: address.contactName ?? null,
    contactPhone: address.contactPhone ?? null,
    line1: address.line1,
    line2: address.line2 ?? null,
    suburb: address.suburb ?? null,
    city: address.city ?? null,
    province: address.province ?? null,
    postalCode: address.postalCode ?? null,
    country: address.country,
    // Omit private gate PINs / internal access notes from immutable Waybill & POD snapshots.
    accessNotes: null,
  };
}

function formatServiceDisplayName(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^[a-z0-9_-]+$/i.test(trimmed) && (trimmed.includes("-") || trimmed.includes("_"))) {
    return trimmed
      .split(/[-_]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }
  return trimmed;
}

function formatPositiveNumber(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const raw = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return Number.isInteger(raw) ? String(raw) : String(Number(raw.toFixed(2)));
}

export function maskEmailSafe(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 1) return trimmed;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  return `${local.slice(0, 2)}***@${domain}`;
}

export interface DocumentOrderRecord {
  id: string;
  orderNumber: string;
  source: string;
  status: string;
  deliveryType: string;
  currency: string;
  createdAt: Date;
  scheduledFor: Date | null;
  parcelCount: number;
  parcelDescription: string | null;
  customerNote: string | null;
  pricingSnapshot?: unknown;
  distanceMeters?: number | null;
  isQaAcceptance?: boolean;
  recipientName: string | null;
  recipientPhone: string | null;
  priceEstimate: { toFixed(digits: number): string } | null;
  pickupAddress: Parameters<typeof projectSafeAddress>[0];
  dropoffAddress: Parameters<typeof projectSafeAddress>[0];
  customer: { name: string | null; email: string } | null;
  store: { name: string; contactEmail?: string | null } | null;
  statusHistory: Array<{ status: string; createdAt: Date }>;
  cashOnDelivery: {
    policyMode: string;
    status: string;
    authoritativePayable: { toFixed(digits: number): string };
    digitalPaid: { toFixed(digits: number): string };
    cashObligation: { toFixed(digits: number): string };
    cashCollected: { toFixed(digits: number): string };
  } | null;
  payments: Array<{
    status: string;
    amount: { toFixed(digits: number): string };
    metadata: unknown;
    succeededAt: Date | null;
  }>;
  marketplaceStoreOrderBridge: {
    storeOrder: { publicReference: string } | null;
  } | null;
  proofOfDelivery: {
    id: string;
    method: string;
    recipientName: string;
    recipientPhone: string | null;
    otpVerifiedAt: Date | null;
    deliveredAt: Date;
    publicNote: string | null;
    evidenceReference: string | null;
    driverProfile: { id: string; displayName: string | null; user: { name: string | null } | null } | null;
  } | null;
}

export function buildWaybillPayload(args: {
  order: DocumentOrderRecord;
  issuer: IssuerIdentitySnapshot;
  documentRef: string;
  revision: number;
  issuedAt: Date;
}): ShipmentWaybillPayload {
  const { order, issuer, documentRef, revision, issuedAt } = args;
  const confirmedEntry = order.statusHistory.find((entry) => entry.status === "CONFIRMED");

  let mode = "DIGITAL_ONLY";
  let modeLabel = "Prepaid Online";
  let paymentStateLabel = "Confirmed";
  let totalZar = order.priceEstimate ? order.priceEstimate.toFixed(2) : null;
  let depositPaidZar = totalZar;
  let cashDueOnDeliveryZar: string | null = "0.00";

  if (order.cashOnDelivery) {
    totalZar = order.cashOnDelivery.authoritativePayable.toFixed(2);
    depositPaidZar = order.cashOnDelivery.digitalPaid.toFixed(2);
    const remainingCash = Math.max(
      0,
      Number(order.cashOnDelivery.cashObligation.toFixed(2)) -
        Number(order.cashOnDelivery.cashCollected.toFixed(2)),
    );
    cashDueOnDeliveryZar = remainingCash.toFixed(2);

    if (order.cashOnDelivery.policyMode === "FULL_COD") {
      mode = "FULL_COD";
      modeLabel = "Approved Historical Full COD";
      paymentStateLabel =
        order.cashOnDelivery.status === "COLLECTED" || order.cashOnDelivery.status === "RECONCILED"
          ? `Cash Collected (${order.currency} ${order.cashOnDelivery.cashCollected.toFixed(2)})`
          : `Collect ${order.currency} ${cashDueOnDeliveryZar} cash at delivery`;
    } else {
      mode = "DEPOSIT_PLUS_COD";
      modeLabel = "50% Deposit Online + 50% Driver Cash";
      paymentStateLabel =
        order.cashOnDelivery.status === "COLLECTED" || order.cashOnDelivery.status === "RECONCILED"
          ? "Deposit Paid & Driver Cash Settled"
          : `Deposit Paid · Collect ${order.currency} ${cashDueOnDeliveryZar} cash at delivery`;
    }
  } else if (order.marketplaceStoreOrderBridge?.storeOrder?.publicReference) {
    mode = "MARKETPLACE_SETTLED";
    modeLabel = "Marketplace Checkout (Settled)";
    paymentStateLabel = `Marketplace Order ${order.marketplaceStoreOrderBridge.storeOrder.publicReference}`;
    depositPaidZar = totalZar;
    cashDueOnDeliveryZar = "0.00";
  } else {
    const succeeded = order.payments.find((p) => p.status === "SUCCEEDED");
    if (succeeded) {
      const meta = asRecord(succeeded.metadata);
      const totalFromMeta = typeof meta.totalPayableAmount === "string" ? meta.totalPayableAmount : null;
      const settledTotal = totalFromMeta ?? succeeded.amount.toFixed(2);
      totalZar = totalZar ?? settledTotal;
      depositPaidZar = settledTotal;
      modeLabel = meta.walletOnly === true ? "Wallet Settled" : "Online Payment Settled";
      paymentStateLabel = "Paid in full";
    }
  }

  const pricingSnapshot = asRecord(order.pricingSnapshot);
  const pricingInput = asRecord(pricingSnapshot.input);
  const pricingRule = asRecord(pricingSnapshot.rule);
  const pricingTariff = asRecord(pricingRule.tariff);
  const senderContact = asRecord(pricingSnapshot.senderContact);
  const snapshotSenderEmail =
    typeof senderContact.email === "string" && senderContact.email.trim()
      ? senderContact.email.trim()
      : null;

  const serviceName =
    formatServiceDisplayName(pricingSnapshot.serviceName) ??
    formatServiceDisplayName(pricingRule.serviceKey) ??
    formatDeliveryTypeLabel(order.deliveryType);
  const parcelSize =
    typeof pricingRule.parcelSize === "string" && pricingRule.parcelSize.trim()
      ? pricingRule.parcelSize.trim().toUpperCase()
      : typeof pricingInput.parcelSize === "string" && pricingInput.parcelSize.trim()
        ? pricingInput.parcelSize.trim().toUpperCase()
        : null;
  // Strictly distinguish declared actual parcel weight from parcel-class maximum limit.
  const actualWeightKg = formatPositiveNumber(pricingInput.actualWeightKg);
  const parcelClassMaxWeightKg = formatPositiveNumber(
    pricingTariff.maximumWeightKg ?? pricingRule.maximumWeightKg,
  );
  const lengthCm = formatPositiveNumber(pricingInput.lengthCm);
  const widthCm = formatPositiveNumber(pricingInput.widthCm);
  const heightCm = formatPositiveNumber(pricingInput.heightCm);
  const dimensionsCm =
    lengthCm && widthCm && heightCm ? `${lengthCm} x ${widthCm} x ${heightCm} cm` : null;
  const routeDistanceKm =
    typeof order.distanceMeters === "number" && order.distanceMeters > 0
      ? (Math.round(order.distanceMeters / 100) / 10).toFixed(1)
      : null;

  const senderDisplayName =
    order.store?.name?.trim() ||
    order.pickupAddress?.contactName?.trim() ||
    order.customer?.name?.trim() ||
    "KT Couriers Customer";

  const recipientName =
    order.recipientName?.trim() ||
    order.dropoffAddress?.contactName?.trim() ||
    "Recipient on file";
  const recipientPhone =
    order.recipientPhone?.trim() ||
    order.dropoffAddress?.contactPhone?.trim() ||
    null;

  return {
    kind: "WAYBILL",
    schemaVersion: 1,
    documentRef,
    revision,
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderSource: order.source,
    deliveryType: order.deliveryType,
    deliveryTypeLabel: formatDeliveryTypeLabel(order.deliveryType),
    serviceName,
    status: order.status,
    statusLabel: formatOrderStatusLabel(order.status),
    parcelCount: order.parcelCount,
    parcelSize,
    actualWeightKg,
    parcelClassMaxWeightKg,
    dimensionsCm,
    routeDistanceKm,
    parcelDescription: order.parcelDescription ?? null,
    customerNote: order.customerNote ?? null,
    createdAtIso: order.createdAt.toISOString(),
    createdAtSast: formatSastAndUtc(order.createdAt) ?? order.createdAt.toISOString(),
    confirmedAtIso: confirmedEntry ? confirmedEntry.createdAt.toISOString() : null,
    confirmedAtSast: confirmedEntry ? formatSastAndUtc(confirmedEntry.createdAt) : null,
    scheduledForIso: order.scheduledFor ? order.scheduledFor.toISOString() : null,
    scheduledForSast: order.scheduledFor ? formatSastAndUtc(order.scheduledFor) : null,
    issuedAtIso: issuedAt.toISOString(),
    issuedAtSast: formatSastAndUtc(issuedAt) ?? issuedAt.toISOString(),
    senderDisplayName,
    senderEmailMaskedOrSafe: maskEmailSafe(snapshotSenderEmail ?? order.customer?.email),
    recipientName,
    recipientPhone,
    pickup: projectSafeAddress(order.pickupAddress),
    dropoff: projectSafeAddress(order.dropoffAddress),
    paymentSummary: {
      mode,
      modeLabel,
      currency: order.currency,
      totalZar,
      depositPaidZar,
      cashDueOnDeliveryZar,
      paymentStateLabel,
    },
    trackingUrl: canonicalTrackingUrl(order.orderNumber),
    issuer,
    ...(order.isQaAcceptance ? { isQaAcceptance: true } : {}),
  };
}

export function buildPodPayload(args: {
  order: DocumentOrderRecord;
  issuer: IssuerIdentitySnapshot;
  documentRef: string;
  revision: number;
  issuedAt: Date;
}): ShipmentPodPayload {
  const { order, issuer, documentRef, revision, issuedAt } = args;
  const pod = order.proofOfDelivery;
  if (!pod) {
    throw new ShipmentDocumentError(
      "POD_PROOF_MISSING",
      409,
      "Official Proof of Delivery requires a verified ProofOfDelivery record.",
    );
  }

  const rawMethod = pod.method;
  const proofMethod: ShipmentPodPayload["proofMethod"] =
    rawMethod === "OTP" ||
    rawMethod === "ADMIN_MANUAL" ||
    rawMethod === "PHOTO_FUTURE" ||
    rawMethod === "SIGNATURE_FUTURE"
      ? rawMethod
      : "ADMIN_MANUAL";

  let proofMethodLabel = "Delivery confirmed by KT Couriers";
  let verificationSummary = "Confirmed delivery recorded by KT Couriers operations.";

  if (proofMethod === "OTP") {
    proofMethodLabel = "Verified 6-digit recipient OTP";
    verificationSummary = "Recipient provided and verified the one-time delivery confirmation PIN with the assigned driver.";
  } else if (proofMethod === "ADMIN_MANUAL") {
    proofMethodLabel = "Manually confirmed by KT Couriers";
    verificationSummary = "Confirmed by an authorised KT Couriers administrator when automated OTP handoff could not be completed.";
  } else if (proofMethod === "PHOTO_FUTURE") {
    proofMethodLabel = "Photographic Proof Recorded";
    verificationSummary = "Photographic handover evidence recorded by KT Couriers.";
  } else if (proofMethod === "SIGNATURE_FUTURE") {
    proofMethodLabel = "Signature Proof Recorded";
    verificationSummary = "Recipient signature acknowledgement recorded by KT Couriers.";
  }

  const rawDriverName =
    pod.driverProfile?.displayName?.trim() ||
    pod.driverProfile?.user?.name?.trim() ||
    null;
  const driverLabel = rawDriverName ? rawDriverName.split(" ")[0] : null;
  const driverDisplay =
    proofMethod === "ADMIN_MANUAL"
      ? driverLabel
        ? `KT Couriers Operations (${driverLabel})`
        : "KT Couriers Operations (Manual Confirmation)"
      : driverLabel
        ? `${driverLabel} (Verified KT Courier)`
        : "KT Couriers Assigned Courier";

  const pickupParts = [
    order.pickupAddress?.suburb,
    order.pickupAddress?.city,
    order.pickupAddress?.province,
  ].filter(Boolean);

  return {
    kind: "POD",
    schemaVersion: 1,
    documentRef,
    revision,
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderSource: order.source,
    deliveryType: order.deliveryType,
    deliveryTypeLabel: formatDeliveryTypeLabel(order.deliveryType),
    proofOfDeliveryId: pod.id,
    proofMethod,
    proofMethodLabel,
    verificationSummary,
    recipientName: pod.recipientName,
    recipientPhone: pod.recipientPhone ?? null,
    deliveredAtIso: pod.deliveredAt.toISOString(),
    deliveredAtSast: formatSastAndUtc(pod.deliveredAt) ?? pod.deliveredAt.toISOString(),
    otpVerifiedAtIso: pod.otpVerifiedAt ? pod.otpVerifiedAt.toISOString() : null,
    otpVerifiedAtSast: pod.otpVerifiedAt ? formatSastAndUtc(pod.otpVerifiedAt) : null,
    issuedAtIso: issuedAt.toISOString(),
    issuedAtSast: formatSastAndUtc(issuedAt) ?? issuedAt.toISOString(),
    driverDisplay,
    parcelCount: order.parcelCount,
    parcelDescription: order.parcelDescription ?? null,
    publicNote: pod.publicNote ?? null,
    hasPrivateMediaEvidence: Boolean(pod.evidenceReference),
    privateMediaNotice: pod.evidenceReference
      ? "Supporting handover evidence reference recorded in KT Couriers secure media vault."
      : null,
    pickupAreaSummary: pickupParts.length ? pickupParts.join(", ") : null,
    dropoffAddress: projectSafeAddress(order.dropoffAddress),
    trackingUrl: canonicalTrackingUrl(order.orderNumber),
    issuer,
    ...(order.isQaAcceptance ? { isQaAcceptance: true } : {}),
  };
}

export function sanitizePayloadForViewerRole<
  T extends ShipmentWaybillPayload | ShipmentPodPayload,
>(payload: T, viewerRole: ShipmentDocumentViewerRole): T {
  // Drivers only receive operational tariff collection instruction, never
  // private sender email or total fee markup on marketplace/store consignments.
  if (viewerRole !== "DRIVER") return payload;

  if (payload.kind === "WAYBILL") {
    return {
      ...payload,
      senderEmailMaskedOrSafe: null,
      paymentSummary: {
        ...payload.paymentSummary,
        totalZar:
          payload.paymentSummary.cashDueOnDeliveryZar &&
          Number(payload.paymentSummary.cashDueOnDeliveryZar) > 0
            ? payload.paymentSummary.totalZar
            : null,
        depositPaidZar: null,
      },
    };
  }

  return payload;
}
