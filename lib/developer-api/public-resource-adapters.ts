/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Public resource adapters are the only bridge from the v1 gateway to canonical
 * business authorities. They deliberately return privacy-minimised DTOs rather
 * than Prisma records. Mutations delegate to Phase 6, order, and store-order
 * services; they never mutate business models from the public route layer.
 */
import { prisma } from "@/lib/db/prisma";
import { createPricingQuoteForTrustedOwner } from "@/lib/services/pricing-quote.service";
import { createOrder, cancelOrder, getOrder } from "@/lib/services/orders.service";
import { acceptMarketplaceStoreOrder, markStoreOrderReadyForHandoff, rejectMarketplaceStoreOrder } from "@/lib/store-orders/store-order.service";
import { DeveloperApiError } from "./contracts";
import { PublicOrderCancelRequestSchema, PublicOrderRequestSchema, PublicQuoteRequestSchema, validatePublicBody } from "./schemas";

export type MachineOwner = Readonly<{ id: string; email: string; name: string | null; role: any; status: any; storeId: string | null }>;

export async function resolveMachineOwner(application: any): Promise<MachineOwner> {
  const user = await prisma.user.findUnique({ where: { id: application.ownerUserId }, select: { id: true, email: true, name: true, role: true, status: true } });
  if (!user || user.status !== "ACTIVE") throw new DeveloperApiError("PUBLIC_API_AUTHENTICATION_FAILED", 401, "Authentication failed.");
  if (application.storeId) { const store = await prisma.store.findFirst({ where: { id: application.storeId, ownerUserId: user.id, status: "ACTIVE" }, select: { id: true } }); if (!store) throw new DeveloperApiError("PUBLIC_API_AUTHENTICATION_FAILED", 401, "Authentication failed."); }
  return { ...user, storeId: application.storeId ?? null };
}

function publicOrder(order: any) { return Object.freeze({ reference: order.orderNumber, status: order.status, deliveryType: order.deliveryType, currency: order.currency, priceEstimate: order.priceEstimate?.toFixed?.(2) ?? null, scheduledFor: order.scheduledFor?.toISOString?.() ?? null, createdAt: order.createdAt?.toISOString?.() ?? null, updatedAt: order.updatedAt?.toISOString?.() ?? null }); }
function publicOrderDetail(order: any) { return Object.freeze({ ...publicOrder(order), recipient: { name: order.recipientName ?? null, phone: order.recipientPhone ? `••••${String(order.recipientPhone).slice(-4)}` : null }, pickup: order.pickupAddress ? { city: order.pickupAddress.city ?? null, province: order.pickupAddress.province ?? null } : null, dropoff: order.dropoffAddress ? { city: order.dropoffAddress.city ?? null, province: order.dropoffAddress.province ?? null } : null }); }

export async function publicServiceAreas() { const areas = await prisma.deliveryRegion.findMany({ where: { active: true }, select: { slug: true, name: true, province: true, city: true }, orderBy: [{ province: "asc" }, { name: "asc" }], take: 100 }); return areas.map((area) => ({ reference: area.slug, name: area.name, province: area.province, city: area.city })); }

export async function publicQuote(owner: MachineOwner, body: any) {
  const request = validatePublicBody(PublicQuoteRequestSchema, body);
  const ownerBinding = owner.storeId ? { ownerType: "STORE" as any, ownerId: owner.id, storeId: owner.storeId } : { ownerType: "CUSTOMER" as any, ownerId: owner.id, storeId: null };
  const quote = await createPricingQuoteForTrustedOwner(ownerBinding, request);
  return Object.freeze({ reference: quote.id, currency: quote.currency, expiresAt: quote.expiresAt.toISOString(), total: quote.total, taxAmount: quote.taxAmount, distanceMeters: quote.distanceMeters, durationSeconds: quote.durationSeconds });
}

export async function publicCreateOrder(owner: MachineOwner, body: any) { const order = await createOrder(owner as any, validatePublicBody(PublicOrderRequestSchema, body)); return publicOrderDetail(order); }
export async function publicOrders(owner: MachineOwner, input: { cursor: string | null; limit: number; status?: string }) {
  const where: any = owner.storeId ? { storeId: owner.storeId } : { customerId: owner.id }; if (input.status) where.status = input.status; if (input.cursor) where.orderNumber = { lt: input.cursor };
  const rows = await prisma.order.findMany({ where, include: { pickupAddress: true, dropoffAddress: true }, orderBy: [{ orderNumber: "desc" }], take: input.limit + 1 }); const more = rows.length > input.limit; const data = rows.slice(0, input.limit).map(publicOrder); return { data, nextReference: more ? rows[input.limit - 1]?.orderNumber ?? null : null, hasMore: more };
}
export async function publicOrderByReference(owner: MachineOwner, reference: string) { const raw = await prisma.order.findFirst({ where: { orderNumber: reference, ...(owner.storeId ? { storeId: owner.storeId } : { customerId: owner.id }) }, select: { id: true } }); if (!raw) throw new DeveloperApiError("PUBLIC_API_RESOURCE_NOT_FOUND", 404, "The requested resource was not found."); const order = await getOrder(owner as any, raw.id); if (!order) throw new DeveloperApiError("PUBLIC_API_RESOURCE_NOT_FOUND", 404, "The requested resource was not found."); return publicOrderDetail(order); }
export async function publicOrderTracking(owner: MachineOwner, reference: string) { const detail = await publicOrderByReference(owner, reference); return Object.freeze({ reference: detail.reference, status: detail.status, scheduledFor: detail.scheduledFor, updatedAt: detail.updatedAt }); }
export async function publicCancelOrder(owner: MachineOwner, reference: string, body: any) { const raw = await prisma.order.findFirst({ where: { orderNumber: reference, ...(owner.storeId ? { storeId: owner.storeId } : { customerId: owner.id }) }, select: { id: true } }); if (!raw) throw new DeveloperApiError("PUBLIC_API_RESOURCE_NOT_FOUND", 404, "The requested resource was not found."); const result = await cancelOrder(owner as any, raw.id, validatePublicBody(PublicOrderCancelRequestSchema, body)); if ("error" in result) throw new DeveloperApiError("ORDER_CANCEL_FAILED", 400, result.error); return publicOrderDetail(result.order); }

function publicProduct(product: any) { return Object.freeze({ reference: product.slug, name: product.name, description: product.description ?? null, currency: product.currency, price: product.price.toFixed?.(2) ?? String(product.price), availability: product.status, image: product.images?.[0] ? { url: product.images[0].url, alt: product.images[0].altText ?? product.name } : null }); }
export async function publicCatalog(owner: MachineOwner, input: { cursor: string | null; limit: number; query?: string }) { if (!owner.storeId) throw new DeveloperApiError("PUBLIC_API_OWNER_DENIED", 403, "Catalog access requires an approved store owner."); const where: any = { storeId: owner.storeId, status: "ACTIVE", ...(input.query ? { name: { contains: input.query, mode: "insensitive" } } : {}) }; if (input.cursor) where.slug = { gt: input.cursor }; const rows = await prisma.product.findMany({ where, include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } }, orderBy: [{ slug: "asc" }], take: input.limit + 1 }); const more = rows.length > input.limit; return { data: rows.slice(0, input.limit).map(publicProduct), nextReference: more ? rows[input.limit - 1]?.slug ?? null : null, hasMore: more }; }
export async function publicCatalogProduct(owner: MachineOwner, reference: string) { if (!owner.storeId) throw new DeveloperApiError("PUBLIC_API_OWNER_DENIED", 403); const product = await prisma.product.findFirst({ where: { storeId: owner.storeId, slug: reference, status: "ACTIVE" }, include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } }); if (!product) throw new DeveloperApiError("PUBLIC_API_RESOURCE_NOT_FOUND", 404, "The requested resource was not found."); return publicProduct(product); }

function publicStoreOrderDto(order: any) { return Object.freeze({ reference: order.publicReference, status: order.derivedStatus, acceptanceStatus: order.acceptanceStatus, preparationStatus: order.preparationStatus, scheduledFulfilmentAt: order.scheduledFulfilmentAt?.toISOString?.() ?? null, createdAt: order.createdAt.toISOString() }); }
export async function publicStoreOrders(owner: MachineOwner, input: { cursor: string | null; limit: number }) { if (!owner.storeId) throw new DeveloperApiError("PUBLIC_API_OWNER_DENIED", 403); const where: any = { storeId: owner.storeId }; if (input.cursor) where.publicReference = { lt: input.cursor }; const rows = await (prisma as any).marketplaceStoreOrder.findMany({ where, orderBy: [{ publicReference: "desc" }], take: input.limit + 1 }); const more = rows.length > input.limit; return { data: rows.slice(0, input.limit).map(publicStoreOrderDto), nextReference: more ? rows[input.limit - 1]?.publicReference ?? null : null, hasMore: more }; }
async function ownedStoreOrder(owner: MachineOwner, reference: string) { if (!owner.storeId) throw new DeveloperApiError("PUBLIC_API_OWNER_DENIED", 403); const order = await (prisma as any).marketplaceStoreOrder.findFirst({ where: { publicReference: reference, storeId: owner.storeId } }); if (!order) throw new DeveloperApiError("PUBLIC_API_RESOURCE_NOT_FOUND", 404, "The requested resource was not found."); return order; }
export async function publicStoreOrder(owner: MachineOwner, reference: string) { return publicStoreOrderDto(await ownedStoreOrder(owner, reference)); }
export async function publicStoreOrderAction(owner: MachineOwner, reference: string, action: "accept" | "reject" | "ready", body: any, operationId: string, requestHash: string) { await ownedStoreOrder(owner, reference); if (action === "accept") return acceptMarketplaceStoreOrder({ storeOrderReference: reference, actorUserId: owner.id, preparationMinutes: Number(body.preparationMinutes ?? 15), pickupInstructions: String(body.pickupInstructions ?? ""), operationId, requestHash }); if (action === "reject") return rejectMarketplaceStoreOrder({ storeOrderReference: reference, actorUserId: owner.id, reasonCode: String(body.reasonCode ?? "INTEGRATION_REJECTED").slice(0, 80), note: typeof body.note === "string" ? body.note.slice(0, 500) : undefined, operationId, requestHash }); return markStoreOrderReadyForHandoff({ storeOrderReference: reference, actorUserId: owner.id, packageEvidence: typeof body.packageEvidence === "object" && body.packageEvidence ? body.packageEvidence : undefined, operationId, requestHash }); }
