/* eslint-disable @typescript-eslint/no-explicit-any */
import { assertPrivacyDisposableDatabase } from "./privacy-disposable-guard";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { UserRole, UserStatus } from "@/types/db";
import { resolveLocationAccess } from "@/lib/services/location-access.service";
import { attachIncidentEvidence, containSecurityIncident, createOperationalIncident, recordIncidentNotificationDecision } from "@/lib/services/operational-incidents.service";

const marker = `LSI${randomUUID().replaceAll("-", "").toUpperCase()}`; let admin = ""; let customer = ""; let unrelated = "";
beforeAll(async () => { await assertPrivacyDisposableDatabase(); const users = await Promise.all(["admin", "customer", "other"].map((kind) => prisma.user.create({ data: { email: `${marker.toLowerCase()}-${kind}@example.test`, name: kind, passwordHash: "proof-only", role: kind === "admin" ? UserRole.ADMIN : UserRole.CUSTOMER, status: UserStatus.ACTIVE } }))); [admin, customer, unrelated] = users.map((row) => row.id); });
describe("Phase B location/security PostgreSQL production-service proof", () => {
  it("rejects foreign tracking on a real synthetic order and expires the owner's live scope", async () => {
    // Operational relationship input only: no payment, custody, driver or GPS evidence is fabricated.
    const order = await prisma.order.create({ data: { orderNumber: marker, source: "CUSTOMER", status: "IN_TRANSIT", deliveryType: "SAME_DAY", customerId: customer, recipientName: "Synthetic location recipient", recipientPhone: "+27820000000", parcelCount: 1, currency: "ZAR" } });
    await expect(resolveLocationAccess({ actorUserId: unrelated, actorRole: "CUSTOMER", orderId: order.id, purpose: "ACTIVE_DELIVERY_TRACKING" })).rejects.toMatchObject({ code: "LOCATION_ACCESS_DENIED" });
    expect(await resolveLocationAccess({ actorUserId: customer, actorRole: "CUSTOMER", orderId: order.id, purpose: "ACTIVE_DELIVERY_TRACKING" })).toMatchObject({ active: true, assignment: null, projection: null });
    await prisma.order.update({ where: { id: order.id }, data: { status: "DELIVERED" } });
    await expect(resolveLocationAccess({ actorUserId: customer, actorRole: "CUSTOMER", orderId: order.id, purpose: "ACTIVE_DELIVERY_TRACKING" })).rejects.toMatchObject({ code: "LOCATION_LIVE_SCOPE_EXPIRED" });
    await expect(resolveLocationAccess({ actorUserId: unrelated, actorRole: "CUSTOMER", orderId: order.id, purpose: "ACTIVE_DELIVERY_TRACKING", privileged: true })).rejects.toMatchObject({ code: "LOCATION_ACCESS_DENIED" });
  });
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
    await expect(attachIncidentEvidence({ ...evidence, safeReference: "DIFFERENT-PAYLOAD" })).rejects.toMatchObject({ code: "SECURITY_INCIDENT_IDEMPOTENCY_CONFLICT" });
    const containment = { actorUserId: admin, publicReference, affectedUserId: customer, createPreservationHold: true, operationId: `${marker}-CONTAIN` };
    const [contained, repeatedContainment] = await Promise.all([containSecurityIncident(containment), containSecurityIncident(containment)]);
    expect(repeatedContainment.id).toBe(contained.id);
    expect(contained.status).toBe("MITIGATING");
    expect(await (prisma as any).operationalIncidentTimeline.count({ where: { incidentId: incident.id, eventType: "NOTIFICATION_DECISION" } })).toBe(1);
    expect(await (prisma as any).operationalIncidentEvidence.count({ where: { incidentId: incident.id } })).toBe(1);
    expect(await (prisma as any).retentionHold.count({ where: { subjectType: "User", subjectReference: customer, releasedAt: null } })).toBe(1);
  });
});
