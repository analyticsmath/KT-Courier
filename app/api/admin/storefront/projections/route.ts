import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { storefrontJson } from "@/lib/storefront/storefront-api-policy";
export async function GET(request: NextRequest) { const auth = await requireAdminApiPermission(PERMISSIONS.STOREFRONT_PROJECTIONS_READ, { request }); if ("response" in auth) return auth.response; const [documents, cases, cache] = await Promise.all([prisma.$queryRaw`SELECT "publicReference", "publicationVersion", "status", "searchable", "indexable", "updatedAt" FROM "StorefrontProductDocument" ORDER BY "updatedAt" DESC LIMIT 100`, prisma.$queryRaw`SELECT "publicReference", "reason", "status", "observationCount", "lastObservedAt" FROM "StorefrontProjectionCase" ORDER BY "lastObservedAt" DESC LIMIT 100`, prisma.$queryRaw`SELECT "publicReference", "tag", "status", "createdAt" FROM "StorefrontCacheInvalidation" ORDER BY "createdAt" DESC LIMIT 100`]); return storefrontJson({ documents, cases, cacheInvalidations: cache }, 200, { private: true }); }

