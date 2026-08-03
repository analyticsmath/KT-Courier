import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
try { const rows = await prisma.$queryRaw`SELECT "publicReference", "reason", "status", "observationCount", "lastObservedAt" FROM "StorefrontProjectionCase" WHERE "status"::text<>'RESOLVED' ORDER BY "lastObservedAt" DESC LIMIT 100`; console.table(rows); process.exitCode = rows.length ? 1 : 0; } catch (error) { console.error(error instanceof Error ? error.message : "Storefront projection-case scan failed."); process.exitCode = 1; } finally { await prisma.$disconnect(); }

