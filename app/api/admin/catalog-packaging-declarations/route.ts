import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { mutation, json, failure } from "@/lib/client-platform/api";
import { PlatformError } from "@/lib/client-platform/contracts";
import { findCatalogPackagingDeclaration, listCatalogPackaging, PACKAGING_PREFIX } from "@/lib/services/catalog-packaging.service";
import { listTrustedPackageVersions, saveTrustedPackageVersion } from "@/lib/marketplace-checkout/parcel-configuration.service";
const inputSchema = z.object({ offerReference: z.string().min(8).max(100), revision: z.uuid(), expectedVersion: z.number().int().nonnegative(), reason: z.string().trim().min(10).max(500) }).strict();
export async function GET() {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMERCIAL_CONFIGURATION_READ); if (auth.response) return auth.response;
  try { return json({ declarations: await listCatalogPackaging() }); } catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMERCIAL_CONFIGURATION_MANAGE, { request }); if (auth.response) return auth.response;
  const prepared = await mutation(request, `catalog-package-review:${auth.user.id}`); if ("response" in prepared) return prepared.response;
  try {
    const input = inputSchema.parse(prepared.body);
    const declaration = await findCatalogPackagingDeclaration(input.offerReference, input.revision);
    if (!declaration) throw new PlatformError("VERSION_CONFLICT", "The vendor measurements changed. Reload before review.", 409);
    const offer = await prisma.storeCatalogOffer.findFirst({ where: { publicReference: input.offerReference, storeId: declaration.storeId, status: "ACTIVE", publicationStatus: "PUBLISHED" }, include: { variant: true } });
    if (!offer) throw new PlatformError("PACKAGE_SOURCE_INVALID", "Publish the reviewed product offer before preparing its delivery packaging approval.", 422);
    const versions = await listTrustedPackageVersions();
    const active = versions.filter(item => item.status === "ACTIVE").sort((a,b) => b.version - a.version)[0];
    const entry = { storeId: offer.storeId, offerReference: offer.publicReference, variantReference: offer.variant.publicReference, publicationVersion: String(offer.version), modifiers: [], packingRule: "SINGLE_PREPACKAGED_UNIT" as const, lengthCm: declaration.lengthCm, widthCm: declaration.widthCm, heightCm: declaration.heightCm, weightKg: declaration.weightKg, authorityReference: `${PACKAGING_PREFIX}${offer.publicReference}:${declaration.revision}` };
    const packages = [...(active?.packages ?? []).filter(item => item.offerReference !== offer.publicReference), entry];
    const result = await saveTrustedPackageVersion(auth.user.id, { packages, bundles: active?.bundles ?? [], effectiveFrom: new Date().toISOString(), effectiveTo: null, expectedVersion: input.expectedVersion, reason: input.reason });
    return json(result, 201);
  } catch (error) { return failure(error); }
}
