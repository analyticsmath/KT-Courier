import { describe, expect, it } from "vitest";
import { evaluateRequiredNotificationGovernance } from "@/lib/production-readiness/notification-governance";

const required = [
  { sourceAuthority: "COURIER_ORDER", eventType: "COURIER_PAYMENT_CONFIRMED", templateKey: "PAYMENT_CONFIRMED", recipientPolicyKey: "COURIER_CUSTOMER" },
  { sourceAuthority: "COURIER_ORDER", eventType: "COURIER_ACCEPTED", templateKey: "COURIER_ACCEPTED", recipientPolicyKey: "COURIER_CUSTOMER" },
] as const;

function root(id: string, key: string) { return { id, key }; }
function templateVersion(id: string, templateId: string, versionNumber: number, status: string, approvedAt: Date | null) {
  return { id, templateId, versionNumber, status, approvedAt };
}
function policy(id: string, versionNumber: number, status = "APPROVED", approvedAt: Date | null = new Date("2026-11-20T00:00:00.000Z")) {
  return { id, key: "COURIER_CUSTOMER", versionNumber, status, approvedAt };
}
function route(id: string, sourceEventType: string) { return { id, sourceAuthority: "COURIER_ORDER", sourceEventType }; }
function activeRoute(routeId: string, templateKey: string, templateVersionId: string, recipientPolicyVersionId: string) {
  return { routeId, status: "ACTIVE", approvedAt: new Date("2026-11-21T00:00:00.000Z"), activatedAt: new Date("2026-11-22T00:00:00.000Z"), templateKey, templateVersionId, recipientPolicyVersionId };
}

describe("production notification governance gates", () => {
  it("does not block approved recipient policies when only template publication and route activation remain", () => {
    const result = evaluateRequiredNotificationGovernance({
      required,
      templateRoots: [root("template-1", "PAYMENT_CONFIRMED"), root("template-2", "COURIER_ACCEPTED")],
      templateVersions: [
        templateVersion("template-version-1", "template-1", 1, "PUBLISHED", new Date("2026-11-20T00:00:00.000Z")),
        templateVersion("template-version-2", "template-2", 1, "APPROVED", new Date("2026-11-20T00:00:00.000Z")),
      ],
      recipientPolicyVersions: [policy("policy-1", 1)],
      routes: [route("route-1", "COURIER_PAYMENT_CONFIRMED")],
      routeVersions: [activeRoute("route-1", "PAYMENT_CONFIRMED", "template-version-1", "policy-1")],
    });

    expect(result.missingTemplates).toEqual(["COURIER_ORDER:COURIER_ACCEPTED"]);
    expect(result.missingRecipientPolicies).toEqual([]);
    expect(result.missingRoutes).toEqual(["COURIER_ORDER:COURIER_ACCEPTED"]);
    expect(result.missingDomains).toEqual(["COURIER_ORDER:COURIER_ACCEPTED"]);
  });

  it("requires the newest policy version to be approved", () => {
    const result = evaluateRequiredNotificationGovernance({
      required: [required[0]],
      templateRoots: [root("template-1", "PAYMENT_CONFIRMED")],
      templateVersions: [templateVersion("template-version-1", "template-1", 1, "PUBLISHED", new Date("2026-11-20T00:00:00.000Z"))],
      recipientPolicyVersions: [policy("policy-1", 1), policy("policy-2", 2, "DRAFT", null)],
      routes: [route("route-1", "COURIER_PAYMENT_CONFIRMED")],
      routeVersions: [activeRoute("route-1", "PAYMENT_CONFIRMED", "template-version-1", "policy-1")],
    });

    expect(result.missingRecipientPolicies).toEqual(["COURIER_ORDER:COURIER_PAYMENT_CONFIRMED"]);
    expect(result.missingRoutes).toEqual(["COURIER_ORDER:COURIER_PAYMENT_CONFIRMED"]);
  });

  it("keeps a route blocked when its active version points at stale template or policy versions", () => {
    const result = evaluateRequiredNotificationGovernance({
      required: [required[0]],
      templateRoots: [root("template-1", "PAYMENT_CONFIRMED")],
      templateVersions: [
        templateVersion("template-version-1", "template-1", 1, "PUBLISHED", new Date("2026-11-20T00:00:00.000Z")),
        templateVersion("template-version-2", "template-1", 2, "PUBLISHED", new Date("2026-11-21T00:00:00.000Z")),
      ],
      recipientPolicyVersions: [policy("policy-1", 1), policy("policy-2", 2)],
      routes: [route("route-1", "COURIER_PAYMENT_CONFIRMED")],
      routeVersions: [activeRoute("route-1", "PAYMENT_CONFIRMED", "template-version-1", "policy-1")],
    });

    expect(result.missingTemplates).toEqual([]);
    expect(result.missingRecipientPolicies).toEqual([]);
    expect(result.missingRoutes).toEqual(["COURIER_ORDER:COURIER_PAYMENT_CONFIRMED"]);
  });
});
