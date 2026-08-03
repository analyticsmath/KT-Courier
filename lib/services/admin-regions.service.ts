import { prisma } from "@/lib/db/prisma";
import type { DeliveryRegion } from "@/types/db";

// ─── DTO ──────────────────────────────────────────────────────────────────────

export interface DeliveryRegionDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
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
  return regions.map(toDto);
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
  city?: string;
  province?: string;
  centerLat?: number;
  centerLng?: number;
  coverageRadiusKm?: number;
  baseFee?: number;
  maxDistanceKm?: number;
  notes?: string;
  displayOrder?: number;
}

export async function createDeliveryRegion(
  input: CreateDeliveryRegionInput
): Promise<DeliveryRegionDto> {
  const region = await prisma.deliveryRegion.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      active: input.active ?? true,
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
  return toDto(region);
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateDeliveryRegion(
  id: string,
  input: Partial<CreateDeliveryRegionInput>
): Promise<DeliveryRegionDto | null> {
  const existing = await prisma.deliveryRegion.findUnique({ where: { id } });
  if (!existing) return null;

  const region = await prisma.deliveryRegion.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.description !== undefined && { description: input.description ?? null }),
      ...(input.active !== undefined && { active: input.active }),
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
  return toDto(region);
}

// ─── Toggle active status ─────────────────────────────────────────────────────

export async function toggleDeliveryRegionActive(
  id: string
): Promise<DeliveryRegionDto | null> {
  const existing = await prisma.deliveryRegion.findUnique({ where: { id } });
  if (!existing) return null;

  const region = await prisma.deliveryRegion.update({
    where: { id },
    data: { active: !existing.active },
  });
  return toDto(region);
}
