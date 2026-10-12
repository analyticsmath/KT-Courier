import { prisma } from "@/lib/db/prisma";
import type { DeliveryRegion } from "@/types/db";
import { assertRegionActivation, regionBoundaryIssues, RegionConfigurationError } from "@/lib/maps/region-boundaries";
import { deliveryCatalog } from "@/lib/client-platform/delivery.service";

// ─── DTO ──────────────────────────────────────────────────────────────────────

export interface DeliveryRegionDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  pricingEnabled: boolean;
  boundaryIssues: string[];
  affectedServiceKeys?: string[];
  serviceInspectionUnavailable?: boolean;
  city: string | null;
  province: string | null;
  centerLat: number | null;
  centerLng: number | null;
  coverageRadiusKm: number | null;
  baseFee: number | null;
  maxDistanceKm: number | null;
  notes: string | null;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

function toDto(region: DeliveryRegion): DeliveryRegionDto {
  return {
    id: region.id,
    name: region.name,
    slug: region.slug,
    description: region.description,
    active: region.active,
    pricingEnabled: region.pricingEnabled,
    boundaryIssues: regionBoundaryIssues(region),
    city: region.city,
    province: region.province,
    centerLat: region.centerLat !== null ? Number(region.centerLat) : null,
    centerLng: region.centerLng !== null ? Number(region.centerLng) : null,
    coverageRadiusKm: region.coverageRadiusKm !== null ? Number(region.coverageRadiusKm) : null,
    baseFee: region.baseFee !== null ? Number(region.baseFee) : null,
    maxDistanceKm: region.maxDistanceKm !== null ? Number(region.maxDistanceKm) : null,
    notes: region.notes,
    displayOrder: region.displayOrder,
    createdAt: region.createdAt,
    updatedAt: region.updatedAt,
  };
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listDeliveryRegions(activeOnly = false): Promise<DeliveryRegionDto[]> {
  const regions = await prisma.deliveryRegion.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });
  const services = await deliveryCatalog().catch(() => null);
  return regions.map((region) => ({ ...toDto(region), serviceInspectionUnavailable: services === null, affectedServiceKeys: services?.filter((s) => !!region.province && s.provinces.includes(region.province as (typeof s.provinces)[number]) && (!s.regionIds.length || s.regionIds.includes(region.id))).map((s) => s.stableKey) }));
}

// ─── Get single ───────────────────────────────────────────────────────────────

export async function getDeliveryRegion(id: string): Promise<DeliveryRegionDto | null> {
  const region = await prisma.deliveryRegion.findUnique({ where: { id } });
  return region ? toDto(region) : null;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export interface CreateDeliveryRegionInput {
  name: string;
  slug: string;
  description?: string;
  active?: boolean;
  pricingEnabled?: boolean;
  expectedUpdatedAt?: string;
  city?: string;
  province?: string | null;
  centerLat?: number | null;
  centerLng?: number | null;
  coverageRadiusKm?: number | null;
  baseFee?: number;
  maxDistanceKm?: number | null;
  notes?: string;
  displayOrder?: number;
}

export async function createDeliveryRegion(
  input: CreateDeliveryRegionInput,
  actorUserId?: string,
): Promise<DeliveryRegionDto> {
  assertRegionActivation({ ...input, active: input.active ?? true, pricingEnabled: input.pricingEnabled ?? true });
  const region = await prisma.$transaction(async (tx) => {
  const created = await tx.deliveryRegion.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      active: input.active ?? true,
      pricingEnabled: input.pricingEnabled ?? true,
      city: input.city ?? null,
      province: input.province ?? null,
      centerLat: input.centerLat ?? null,
      centerLng: input.centerLng ?? null,
      coverageRadiusKm: input.coverageRadiusKm ?? null,
      baseFee: input.baseFee ?? null,
      maxDistanceKm: input.maxDistanceKm ?? null,
      notes: input.notes ?? null,
      displayOrder: input.displayOrder ?? 0,
    },
  });
  if (actorUserId) await tx.adminActivityLog.create({ data: { actorUserId, action: "CREATE", entityType: "DeliveryRegion", entityId: created.id, message: `Created delivery region: ${created.name}`, metadata: { active: created.active, pricingEnabled: created.pricingEnabled, boundaryIssues: regionBoundaryIssues(created) } } });
  return created;
  });
  return toDto(region);
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateDeliveryRegion(
  id: string,
  input: Partial<CreateDeliveryRegionInput>,
  actorUserId?: string,
): Promise<DeliveryRegionDto | null> {
  const existing = await prisma.deliveryRegion.findUnique({ where: { id } });
  if (!existing) return null;

  if (!input.expectedUpdatedAt || new Date(input.expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()) {
    throw new RegionConfigurationError(409, "Region changed. Refresh before saving.");
  }
  assertRegionActivation({ ...existing, ...input });
  const region = await prisma.$transaction(async (tx) => {
  const updated = await tx.deliveryRegion.update({
    where: { id, updatedAt: existing.updatedAt },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.description !== undefined && { description: input.description ?? null }),
      ...(input.active !== undefined && { active: input.active }),
      ...(input.pricingEnabled !== undefined && { pricingEnabled: input.pricingEnabled }),
      ...(input.city !== undefined && { city: input.city ?? null }),
      ...(input.province !== undefined && { province: input.province ?? null }),
      ...(input.centerLat !== undefined && { centerLat: input.centerLat ?? null }),
      ...(input.centerLng !== undefined && { centerLng: input.centerLng ?? null }),
      ...(input.coverageRadiusKm !== undefined && { coverageRadiusKm: input.coverageRadiusKm ?? null }),
      ...(input.baseFee !== undefined && { baseFee: input.baseFee ?? null }),
      ...(input.maxDistanceKm !== undefined && { maxDistanceKm: input.maxDistanceKm ?? null }),
      ...(input.notes !== undefined && { notes: input.notes ?? null }),
      ...(input.displayOrder !== undefined && { displayOrder: input.displayOrder }),
    },
  });
  if (actorUserId) await tx.adminActivityLog.create({ data: { actorUserId, action: "UPDATE", entityType: "DeliveryRegion", entityId: id, message: `Updated delivery region: ${updated.name}`, metadata: { priorUpdatedAt: existing.updatedAt.toISOString(), changedFields: Object.keys(input).filter((key) => key !== "expectedUpdatedAt"), active: updated.active, pricingEnabled: updated.pricingEnabled, boundaryIssues: regionBoundaryIssues(updated) } } });
  return updated;
  });
  return toDto(region);
}

// ─── Toggle active status ─────────────────────────────────────────────────────

export async function toggleDeliveryRegionActive(
  id: string,
  expectedUpdatedAt?: string,
  actorUserId?: string,
): Promise<DeliveryRegionDto | null> {
  const existing = await prisma.deliveryRegion.findUnique({ where: { id } });
  if (!existing) return null;

  return updateDeliveryRegion(id, { active: !existing.active, expectedUpdatedAt }, actorUserId);
}
