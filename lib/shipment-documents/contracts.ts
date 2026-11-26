export const SHIPMENT_DOCUMENT_RENDERER_VERSION = "kt-pdf-v1" as const;
export const TRACKING_SHARE_COOKIE_NAME = "kt_track_grant" as const;
export const TRACKING_GRANT_DEFAULT_TTL_DAYS = 14;
export const TRACKING_GRANT_MAX_TTL_DAYS = 30;
export const CANONICAL_PUBLIC_ORIGIN = "https://www.ktcouriers.com" as const;

export type ShipmentDocumentKind = "WAYBILL" | "POD";
export type ShipmentDocumentViewerRole = "CUSTOMER" | "STORE" | "DRIVER" | "ADMIN";

export class ShipmentDocumentError extends Error {
  constructor(
    readonly code:
      | "UNAUTHORIZED"
      | "FORBIDDEN"
      | "ORDER_NOT_FOUND"
      | "COMPANY_PROFILE_REQUIRED"
      | "WAYBILL_NOT_ELIGIBLE"
      | "POD_PROOF_MISSING"
      | "DOCUMENT_NOT_FOUND"
      | "DOCUMENT_INTEGRITY_ERROR",
    readonly statusCode: number,
    message: string,
    readonly actionHref?: string,
  ) {
    super(message);
    this.name = "ShipmentDocumentError";
  }
}

export interface IssuerIdentitySnapshot {
  companyProfileVersionId: string;
  publicReference: string | null;
  versionNumber: number;
  legalName: string;
  tradingName: string | null;
  registrationNumber: string | null;
  vatNumber: string | null;
  supportEmail: string | null;
  businessEmail: string | null;
  telephoneNumbers: string[];
  website: string;
  physicalAddress: string | null;
  walkInOffice: boolean;
}

export interface ShipmentAddressSnapshot {
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
}

export interface ShipmentWaybillPayload {
  kind: "WAYBILL";
  schemaVersion: 1;
  documentRef: string;
  revision: number;
  orderId: string;
  orderNumber: string;
  orderSource: string;
  deliveryType: string;
  deliveryTypeLabel: string;
  serviceName?: string | null;
  status: string;
  statusLabel: string;
  parcelCount: number;
  parcelSize?: string | null;
  actualWeightKg?: string | null;
  parcelClassMaxWeightKg?: string | null;
  dimensionsCm?: string | null;
  routeDistanceKm?: string | null;
  parcelDescription: string | null;
  customerNote: string | null;
  createdAtIso: string;
  createdAtSast: string;
  confirmedAtIso: string | null;
  confirmedAtSast: string | null;
  scheduledForIso: string | null;
  scheduledForSast: string | null;
  issuedAtIso: string;
  issuedAtSast: string;
  senderDisplayName: string;
  senderEmailMaskedOrSafe: string | null;
  recipientName: string;
  recipientPhone: string | null;
  pickup: ShipmentAddressSnapshot | null;
  dropoff: ShipmentAddressSnapshot | null;
  paymentSummary: {
    mode: string;
    modeLabel: string;
    currency: string;
    totalZar: string | null;
    depositPaidZar: string | null;
    cashDueOnDeliveryZar: string | null;
    paymentStateLabel: string;
  };
  trackingUrl: string;
  issuer: IssuerIdentitySnapshot;
  isSample?: boolean;
}

export interface ShipmentPodPayload {
  kind: "POD";
  schemaVersion: 1;
  documentRef: string;
  revision: number;
  orderId: string;
  orderNumber: string;
  orderSource: string;
  deliveryType: string;
  deliveryTypeLabel: string;
  proofOfDeliveryId: string;
  proofMethod: "OTP" | "ADMIN_MANUAL" | "PHOTO_FUTURE" | "SIGNATURE_FUTURE";
  proofMethodLabel: string;
  verificationSummary: string;
  recipientName: string;
  recipientPhone: string | null;
  deliveredAtIso: string;
  deliveredAtSast: string;
  otpVerifiedAtIso: string | null;
  otpVerifiedAtSast: string | null;
  issuedAtIso: string;
  issuedAtSast: string;
  driverDisplay: string;
  parcelCount: number;
  parcelDescription: string | null;
  publicNote: string | null;
  hasPrivateMediaEvidence: boolean;
  privateMediaNotice: string | null;
  pickupAreaSummary: string | null;
  dropoffAddress: ShipmentAddressSnapshot | null;
  trackingUrl: string;
  issuer: IssuerIdentitySnapshot;
  isSample?: boolean;
}

export type AnyShipmentDocumentPayload = ShipmentWaybillPayload | ShipmentPodPayload;

export interface PublicTrackingMilestone {
  key: string;
  label: string;
  description: string;
  state: "COMPLETED" | "CURRENT" | "UPCOMING" | "EXCEPTION";
  occurredAtIso: string | null;
  occurredAtSast: string | null;
}

export interface PublicTrackingStatusProjection {
  grantRef: string;
  orderNumber: string;
  status: string;
  statusLabel: string;
  statusTone: "neutral" | "information" | "success" | "warning" | "danger";
  deliveryTypeLabel: string;
  parcelCount: number;
  pickupArea: string;
  dropoffArea: string;
  createdAtIso: string;
  createdAtSast: string;
  scheduledForIso: string | null;
  scheduledForSast: string | null;
  deliveredAtIso: string | null;
  deliveredAtSast: string | null;
  expiresAtIso: string;
  expiresAtSast: string;
  milestones: PublicTrackingMilestone[];
  issuer: {
    tradingName: string;
    legalName: string;
    supportEmail: string | null;
    primaryPhone: string;
    websiteUrl: string;
  } | null;
}

export function resolvePublicTrackingOrigin(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate.trim());
      if (url.protocol === "https:" && !/^(localhost|127\.0\.0\.1)$/i.test(url.hostname)) {
        return url.origin;
      }
    } catch {
      // ignore invalid URL env values
    }
  }
  return CANONICAL_PUBLIC_ORIGIN;
}

export function canonicalTrackingUrl(orderNumber: string): string {
  return `${resolvePublicTrackingOrigin()}/track?reference=${encodeURIComponent(orderNumber)}`;
}

export function formatSastAndUtc(input: Date | string | null | undefined): string | null {
  if (!input) return null;
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;

  const sastFormatter = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const utcFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return `${sastFormatter.format(date)} SAST (${utcFormatter.format(date)} UTC)`;
}
