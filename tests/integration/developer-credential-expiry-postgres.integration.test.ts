import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { DeveloperApiMaintenanceService } from "@/lib/developer-api/processor-service";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";

const marker = `credential-expiry-${randomUUID()}`;
let validated = false;
beforeAll(() => { requireDisposableStoreSettlementDatabase(); validated = true; });
afterAll(async () => {
  if (!validated) return;
  await prisma.developerApiAuditEvent.deleteMany({ where: { entityReference: { startsWith: marker } } });
  await prisma.developerApiCredential.deleteMany({ where: { publicReference: { startsWith: marker } } });
  await prisma.$disconnect();
});

it("expires one due credential exactly once and preserves a concurrently revoked credential", async () => {
  const create = (suffix: string) => prisma.developerApiCredential.create({ data: { publicReference: `${marker}-${suffix}`, applicationId: marker, scopeGrantId: marker, environment: "TEST", prefix: suffix, fingerprint: `${marker}-${suffix}`, credentialHash: "disposable-hash", maskedDisplay: "masked", status: "ACTIVE", expiresAt: new Date("2020-01-01") } });
  const due = await create("due");
  const revoked = await create("revoked");
  await prisma.developerApiCredential.update({ where: { id: revoked.id }, data: { status: "REVOKED", revokedAt: new Date() } });
  const service = new DeveloperApiMaintenanceService(prisma);
  const results = await Promise.all([service.expireCredential(due), service.expireCredential(due), service.expireCredential(revoked)]);
  expect(results.filter((result) => result.expired)).toHaveLength(1);
  expect((await prisma.developerApiCredential.findUniqueOrThrow({ where: { id: due.id } })).status).toBe("EXPIRED");
  expect((await prisma.developerApiCredential.findUniqueOrThrow({ where: { id: revoked.id } })).status).toBe("REVOKED");
  expect(await prisma.developerApiAuditEvent.count({ where: { entityReference: due.publicReference, eventType: "DEVELOPER_CREDENTIAL_EXPIRED" } })).toBe(1);
});
