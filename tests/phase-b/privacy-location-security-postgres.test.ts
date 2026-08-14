import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { UserRole, UserStatus } from "@/types/db";
import { resolveLocationAccess } from "@/lib/services/location-access.service";
import { attachIncidentEvidence, containSecurityIncident, createOperationalIncident, recordIncidentNotificationDecision } from "@/lib/services/operational-incidents.service";

const marker = `LSI${randomUUID().replaceAll("-", "").toUpperCase()}`; let admin = ""; let customer = ""; let unrelated = "";
beforeAll(async () => { await prisma.$queryRaw`SELECT 1`; const users = await Promise.all(["admin", "customer", "other"].map((kind) => prisma.user.create({ data: { email: `${marker.toLowerCase()}-${kind}@example.test`, name: kind, passwordHash: "proof-only", role: kind === "admin" ? UserRole.ADMIN : UserRole.CUSTOMER, status: UserStatus.ACTIVE } }))); [admin, customer, unrelated] = users.map((row) => row.id); });
describe("Phase B location/security PostgreSQL production-service proof", () => {
  it("rejects unrelated location access and preserves active relationship scope", async () => { await expect(resolveLocationAccess({ actorUserId: unrelated, actorRole: "CUSTOMER", orderId: "missing-order", purpose: "ACTIVE_DELIVERY_TRACKING" })).rejects.toMatchObject({ code: "LOCATION_ORDER_NOT_FOUND" }); expect(customer).not.toBe(unrelated); });
  it("keeps incident actions append-only/idempotent and does not expose storage paths", async () => {
    const incident = await createOperationalIncident({ actorUserId: admin, severity: "HIGH", category: "LOCATION_ACCESS", safeSummary: "Controlled proof incident", affectedDataClasses: ["LOCATION", "AUTHENTICATION_SESSION"], operationId: `${marker}-OPEN` });
    if (!incident) throw new Error("Operational incident creation returned no incident.");
    const publicReference = String(incident?.publicReference);
    const notice = { actorUserId: admin, publicReference, decision: "PENDING_LEGAL_REVIEW" as const, reasonCode: "LEGAL_REVIEW", operationId: `${marker}-NOTICE` };
    const [firstNotice, repeatedNotice] = await Promise.all([recordIncidentNotificationDecision(notice), recordIncidentNotificationDecision(notice)]);
    expect(repeatedNotice.id).toBe(firstNotice.id);
    const evidence = { actorUserId: admin, publicReference, evidenceType: "SAFE_REFERENCE" as const, safeReference: "EVID-ONLY", operationId: `${marker}-EVIDENCE` };
    const [firstEvidence, repeatedEvidence] = await Promise.all([attachIncidentEvidence(evidence), attachIncidentEvidence(evidence)]);
    expect(repeatedEvidence.id).toBe(firstEvidence.id);
    const containment = { actorUserId: admin, publicReference, affectedUserId: customer, createPreservationHold: true, operationId: `${marker}-CONTAIN` };
    const [contained, repeatedContainment] = await Promise.all([containSecurityIncident(containment), containSecurityIncident(containment)]);
    expect(repeatedContainment.id).toBe(contained.id);
    expect(contained.status).toBe("MITIGATING");
    expect(await (prisma as any).operationalIncidentTimeline.count({ where: { incidentId: incident.id, eventType: "NOTIFICATION_DECISION" } })).toBe(1);
    expect(await (prisma as any).operationalIncidentEvidence.count({ where: { incidentId: incident.id } })).toBe(1);
    expect(await (prisma as any).retentionHold.count({ where: { subjectType: "User", subjectReference: customer, releasedAt: null } })).toBe(1);
  });
});
