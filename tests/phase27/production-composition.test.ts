import { describe, expect, it } from "vitest";
import { NOTIFICATION_PRODUCTION_COMPOSITION_ORDER, resolveNotificationProductionComposition } from "@/lib/notifications/composition-root";

describe("Phase 27 production composition", () => {
  it("uses concrete repositories, not-configured providers and remains locked", () => {
    const composition = resolveNotificationProductionComposition();
    if (composition.status === "LOCKED") {
      expect(composition.code).toBe("NOTIFICATION_CONSOLIDATED_VALIDATION_NOT_APPROVED");
    }
    expect(composition.providers.get("EMAIL")?.name).toBe("EMAIL_PROVIDER_NOT_CONFIGURED");
    expect("inbox" in composition.repositories).toBe(true);
    expect(NOTIFICATION_PRODUCTION_COMPOSITION_ORDER).toEqual(["concrete Prisma notification repositories", "canonical User and verified-contact authority", "role-profile recipient adapters", "concrete encryption or secret authority", "concrete strict template renderer", "preference and consent services", "source-event adapters", "recipient-policy service", "concrete inbox authority", "production email adapter", "production SMS adapter", "production push adapter", "delivery service", "receipt ingestion", "suppression service", "reconciliation service", "processor suite"]);
  });
});
