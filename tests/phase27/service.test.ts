import { describe, expect, it } from "vitest";
import { createNotificationAuthority, RECIPIENT_SUBJECTS, RECONCILIATION_ACTIONS } from "@/lib/notifications/authority";
import { PHASE27_EVENT_REGISTRY } from "@/lib/notifications/event-registry";

describe("Phase 27 canonical services", () => {
  it("exposes one service for every canonical authority", () => {
    const authority = createNotificationAuthority({}, new Map());
    expect(Object.keys(authority).sort()).toEqual(["categories", "delivery", "digests", "endpoints", "inbox", "intake", "preferences", "recipients", "reconciliation", "routes", "suppressions", "templates"]);
  });

  it("uses exact recipient subjects and only narrow reconciliation actions", () => {
    expect(RECIPIENT_SUBJECTS).toContain("ASSIGNED_DRIVER");
    expect(RECIPIENT_SUBJECTS).toContain("RECRUITMENT_APPLICANT");
    expect(RECIPIENT_SUBJECTS).not.toContain("ALL_ADMINS");
    expect(RECONCILIATION_ACTIONS).not.toContain("resolve" as never);
  });

  it("registers only durable event families already found in the repository", () => {
    expect(PHASE27_EVENT_REGISTRY.map((event) => event.eventType)).toEqual(expect.arrayContaining(["ORDER_CONFIRMED", "PASSWORD_RESET", "SUBSCRIPTION_ACTIVATED"]));
    expect(PHASE27_EVENT_REGISTRY.every((event) => event.categoryKey.length > 0)).toBe(true);
  });
});
