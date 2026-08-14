import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");
describe("privacy location and security incident controls", () => {
  it("keeps location writes assigned-driver scoped and reads relationship/purpose scoped", () => {
    const write = read("lib/services/driver-location-evidence.service.ts"); const access = read("lib/services/location-access.service.ts"); const customer = read("app/api/tracking/orders/[orderId]/location/route.ts");
    expect(write).toMatch(/authority\.driverUserId !== driverUserId/); expect(write).toMatch(/DRIVER_OPERATION_FORBIDDEN/);
    expect(access).toMatch(/ACTIVE_ORDER_STATUSES/); expect(access).toMatch(/order\.customerId === input\.actorUserId/); expect(access).toMatch(/ownerUserId === input\.actorUserId/); expect(access).toMatch(/LOCATION_LIVE_SCOPE_EXPIRED/); expect(access).toMatch(/recordAdminActivity/);
    expect(customer).toMatch(/resolveLocationAccess/); expect(write).toMatch(/observedAt/); expect(write).toMatch(/source: latest\.source/);
  });
  it("integrates location retention with canonical hold/policy resolution without logging coordinates", () => {
    const access = read("lib/services/location-access.service.ts"); const retention = read("lib/retention/privacy-retention.service.ts");
    expect(access).toMatch(/resolveRetentionPolicy\("LOCATION_DATA"\)/); expect(access).toMatch(/evaluateRetentionHolds/); expect(retention).toMatch(/LOCATION_DATA/);
    expect(access).not.toMatch(/console\.log.*latitude/);
  });
  it("extends the existing incident aggregate with controlled evidence, containment, notification and hold boundaries", () => {
    const schema = read("prisma/schema.prisma"); const service = read("lib/services/operational-incidents.service.ts"); const contain = read("app/api/admin/incidents/[reference]/contain/route.ts");
    expect(schema).toMatch(/model OperationalIncident[\s\S]*affectedDataClasses[\s\S]*notificationDecision/); expect(schema).toMatch(/model OperationalIncidentEvidence[\s\S]*privateMediaObjectId[\s\S]*operationId/);
    expect(service).toMatch(/transitions/); expect(service).toMatch(/SECURITY_INCIDENT_CONTAINMENT_FAILED/); expect(service).toMatch(/createRetentionHold/); expect(service).toMatch(/revokeAllUserSessions/); expect(service).toMatch(/recordIncidentNotificationDecision/);
    expect(contain).toMatch(/SECURITY_INCIDENTS_RESOLVE/); expect(service).not.toMatch(/storageReference/);
  });
});
