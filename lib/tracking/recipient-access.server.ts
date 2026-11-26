import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import {
  formatSastAndUtc,
  resolvePublicTrackingOrigin,
  ShipmentDocumentError,
  TRACKING_GRANT_DEFAULT_TTL_DAYS,
  TRACKING_GRANT_MAX_TTL_DAYS,
  TRACKING_SHARE_COOKIE_NAME,
  type PublicTrackingStatusProjection,
} from "@/lib/shipment-documents/contracts";
import {
  authorizeShipmentDocumentAccess,
  type AuthorizedShipmentOrderContext,
} from "@/lib/shipment-documents/authorization";
import {
  formatDeliveryTypeLabel,
  parseTelephoneNumbers,
} from "@/lib/shipment-documents/projection";
import { currentCompanyProfileWithDb } from "@/lib/services/company-profile.service";
import type { AuthenticatedUser } from "@/types/domain";
import {
  buildPublicTrackingMilestones,
  formatPublicAreaLabel,
  normalizePublicOrderStatusLabel,
} from "./public-timeline";

export const GENERIC_TRACKING_LINK_ERROR =
  "This tracking link is invalid, expired, or has been revoked. Ask the sender for a new tracking link or sign in to your KT Couriers account.";

export function hashTrackingGrantToken(rawToken: string): string {
  return createHash("sha256").update(rawToken.trim(), "utf8").digest("hex");
}

function makeGrantRef(): string {
  return `TRK-${randomBytes(6).toString("hex").toUpperCase()}`;
}

export interface TrackingGrantMetadataDto {
  id: string;
  grantRef: string;
  scope: "STATUS_ONLY";
  issuedAtIso: string;
  issuedAtSast: string;
  expiresAtIso: string;
  expiresAtSast: string;
  revokedAtIso: string | null;
  active: boolean;
}

function toGrantDto(row: {
  id: string;
  grantRef: string;
  scope: "STATUS_ONLY";
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}, now: Date): TrackingGrantMetadataDto {
  return {
    id: row.id,
    grantRef: row.grantRef,
    scope: row.scope,
    issuedAtIso: row.issuedAt.toISOString(),
    issuedAtSast: formatSastAndUtc(row.issuedAt) ?? row.issuedAt.toISOString(),
    expiresAtIso: row.expiresAt.toISOString(),
    expiresAtSast: formatSastAndUtc(row.expiresAt) ?? row.expiresAt.toISOString(),
    revokedAtIso: row.revokedAt ? row.revokedAt.toISOString() : null,
    active: row.revokedAt === null && row.expiresAt > now,
  };
}

export async function listTrackingShareGrants(args: {
  user: AuthenticatedUser | null;
  orderId: string;
  explicitStoreId?: string | null;
}): Promise<{ context: AuthorizedShipmentOrderContext; grants: TrackingGrantMetadataDto[] }> {
  const context = await authorizeShipmentDocumentAccess({
    user: args.user,
    orderId: args.orderId,
    action: "TRACKING_GRANT",
    explicitStoreId: args.explicitStoreId,
  });

  const now = new Date();
  const rows = await prisma.shipmentTrackingGrant.findMany({
    where: { orderId: context.orderId },
    orderBy: [{ issuedAt: "desc" }],
    take: 25,
    select: {
      id: true,
      grantRef: true,
      scope: true,
      issuedAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  return {
    context,
    grants: rows.map((row) => toGrantDto(row, now)),
  };
}

export async function issueTrackingShareGrant(args: {
  user: AuthenticatedUser | null;
  orderId: string;
  ttlDays?: number;
  explicitStoreId?: string | null;
}): Promise<{
  context: AuthorizedShipmentOrderContext;
  grant: TrackingGrantMetadataDto;
  shareUrl: string;
}> {
  const context = await authorizeShipmentDocumentAccess({
    user: args.user,
    orderId: args.orderId,
    action: "TRACKING_GRANT",
    explicitStoreId: args.explicitStoreId,
  });

  if (context.orderStatus === "CANCELLED") {
    throw new ShipmentDocumentError(
      "WAYBILL_NOT_ELIGIBLE",
      409,
      "Cannot create a tracking share link for a cancelled shipment.",
    );
  }

  const days = Math.min(
    Math.max(Math.trunc(args.ttlDays ?? TRACKING_GRANT_DEFAULT_TTL_DAYS), 1),
    TRACKING_GRANT_MAX_TTL_DAYS,
  );
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + days * 24 * 60 * 60 * 1000);
  const rawToken = randomBytes(32).toString("base64url");
  const tokenSha256 = hashTrackingGrantToken(rawToken);
  const grantRef = makeGrantRef();

  const created = await prisma.shipmentTrackingGrant.create({
    data: {
      grantRef,
      orderId: context.orderId,
      tokenSha256,
      scope: "STATUS_ONLY",
      issuedByUserId: context.actorUserId,
      issuedByRole: context.viewerRole,
      issuedAt,
      expiresAt,
    },
    select: {
      id: true,
      grantRef: true,
      scope: true,
      issuedAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  // Token sits strictly in URL fragment (#token=) so it never reaches HTTP server logs
  // or third-party Referer headers; client exchanges it for an HttpOnly scoped cookie.
  const shareUrl = `${resolvePublicTrackingOrigin()}/track/share#token=${encodeURIComponent(rawToken)}`;

  return {
    context,
    grant: toGrantDto(created, issuedAt),
    shareUrl,
  };
}

export async function revokeTrackingShareGrant(args: {
  user: AuthenticatedUser | null;
  orderId: string;
  grantId?: string | null;
  grantRef?: string | null;
  reason?: string | null;
  explicitStoreId?: string | null;
}): Promise<{ revoked: boolean; grantRef: string | null }> {
  const context = await authorizeShipmentDocumentAccess({
    user: args.user,
    orderId: args.orderId,
    action: "TRACKING_GRANT",
    explicitStoreId: args.explicitStoreId,
  });

  const whereClause = args.grantId
    ? { id: args.grantId, orderId: context.orderId, revokedAt: null }
    : args.grantRef
      ? { grantRef: args.grantRef, orderId: context.orderId, revokedAt: null }
      : null;

  if (!whereClause) {
    throw new ShipmentDocumentError(
      "DOCUMENT_NOT_FOUND",
      400,
      "Specify a tracking grant to revoke.",
    );
  }

  const target = await prisma.shipmentTrackingGrant.findFirst({
    where: whereClause,
    select: { id: true, grantRef: true },
  });
  if (!target) {
    return { revoked: false, grantRef: null };
  }

  await prisma.shipmentTrackingGrant.update({
    where: { id: target.id },
    data: {
      revokedAt: new Date(),
      revokedByUserId: context.actorUserId,
      revokeReason: args.reason?.trim().slice(0, 300) || "Revoked by authorized sender/operator",
    },
  });

  return { revoked: true, grantRef: target.grantRef };
}

export async function verifyAndResolveTrackingToken(
  rawToken: string | null | undefined,
  expectedGrantRef?: string | null,
): Promise<{
  grantId: string;
  grantRef: string;
  expiresAt: Date;
  projection: PublicTrackingStatusProjection;
} | null> {
  if (!rawToken || rawToken.trim().length < 16 || rawToken.trim().length > 200) {
    return null;
  }

  const tokenSha256 = hashTrackingGrantToken(rawToken);
  const now = new Date();

  const grant = await prisma.shipmentTrackingGrant.findFirst({
    where: {
      tokenSha256,
      ...(expectedGrantRef ? { grantRef: expectedGrantRef.trim() } : {}),
      revokedAt: null,
      expiresAt: { gt: now },
    },
    select: {
      id: true,
      grantRef: true,
      expiresAt: true,
      order: {
        select: {
          orderNumber: true,
          status: true,
          deliveryType: true,
          parcelCount: true,
          createdAt: true,
          scheduledFor: true,
          pickupAddress: { select: { suburb: true, city: true, province: true } },
          dropoffAddress: { select: { suburb: true, city: true, province: true } },
          statusHistory: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { status: true, createdAt: true },
          },
          proofOfDelivery: {
            select: { deliveredAt: true },
          },
        },
      },
    },
  });

  if (!grant || !grant.order) return null;

  const [company] = await Promise.all([currentCompanyProfileWithDb(prisma)]);
  const { order } = grant;
  const statusInfo = normalizePublicOrderStatusLabel(order.status);
  const deliveredAt = order.proofOfDelivery?.deliveredAt ?? null;
  const milestones = buildPublicTrackingMilestones({
    currentStatus: order.status,
    createdAt: order.createdAt,
    deliveredAt,
    history: order.statusHistory,
  });

  const phones = company ? parseTelephoneNumbers(company.telephoneNumbers) : [];

  return {
    grantId: grant.id,
    grantRef: grant.grantRef,
    expiresAt: grant.expiresAt,
    projection: {
      grantRef: grant.grantRef,
      orderNumber: order.orderNumber,
      status: order.status,
      statusLabel: statusInfo.label,
      statusTone: statusInfo.tone,
      deliveryTypeLabel: formatDeliveryTypeLabel(order.deliveryType),
      parcelCount: order.parcelCount,
      pickupArea: formatPublicAreaLabel(order.pickupAddress, "Confirmed collection area"),
      dropoffArea: formatPublicAreaLabel(order.dropoffAddress, "Confirmed destination area"),
      createdAtIso: order.createdAt.toISOString(),
      createdAtSast: formatSastAndUtc(order.createdAt) ?? order.createdAt.toISOString(),
      scheduledForIso: order.scheduledFor ? order.scheduledFor.toISOString() : null,
      scheduledForSast: formatSastAndUtc(order.scheduledFor),
      deliveredAtIso: deliveredAt ? deliveredAt.toISOString() : null,
      deliveredAtSast: formatSastAndUtc(deliveredAt),
      expiresAtIso: grant.expiresAt.toISOString(),
      expiresAtSast: formatSastAndUtc(grant.expiresAt) ?? grant.expiresAt.toISOString(),
      milestones,
      issuer: company
        ? {
            tradingName: company.tradingName || company.legalName,
            legalName: company.legalName,
            supportEmail: company.supportEmail,
            primaryPhone: phones[0] ?? "",
            websiteUrl: company.website ?? "https://www.ktcouriers.com",
          }
        : null,
    },
  };
}

export async function readTrackingGrantFromRequestCookies(
  expectedGrantRef?: string | null,
): Promise<PublicTrackingStatusProjection | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(TRACKING_SHARE_COOKIE_NAME)?.value;
  const resolved = await verifyAndResolveTrackingToken(rawToken, expectedGrantRef);
  return resolved?.projection ?? null;
}

export function trackingShareCookieOptions(expiresAt: Date) {
  const isProd = process.env.NODE_ENV === "production" && process.env.USE_HOST_COOKIE !== "false";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/track",
    expires: expiresAt,
  };
}
