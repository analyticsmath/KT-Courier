import { describe, expect, it } from "vitest";
import {
  DEVELOPER_API_PRODUCTION_COMPOSITION_ORDER,
  resolveDeveloperApiProductionComposition,
  resolveDeveloperApiProductionCompositionAsync,
} from "@/lib/developer-api/composition-root";
import { DEVELOPER_API_PRODUCTION_LOCK_REASON } from "@/lib/developer-api/contracts";
import { DEVELOPER_API_ACTIVATION_SETTING_KEY } from "@/lib/developer-api/activation";

describe("Phase 28 production composition", () => {
  it("constructs concrete repositories and fails closed until dual-control activation & secrets are verified", async () => {
    expect(DEVELOPER_API_PRODUCTION_COMPOSITION_ORDER).toEqual(
      expect.arrayContaining([
        "concrete Prisma developer repositories",
        "credential keyed-hash authority",
        "rate-limit service",
        "quota service",
        "canonical source-event adapters",
        "webhook public-projection adapters",
        "webhook delivery service",
        "readiness assertion",
      ]),
    );
    expect(
      DEVELOPER_API_PRODUCTION_COMPOSITION_ORDER.indexOf("concrete Prisma developer repositories"),
    ).toBeLessThan(DEVELOPER_API_PRODUCTION_COMPOSITION_ORDER.indexOf("readiness assertion"));

    const syncComposition = resolveDeveloperApiProductionComposition();
    expect(syncComposition.status).toBe("LOCKED");
    expect(syncComposition).toMatchObject({ code: DEVELOPER_API_PRODUCTION_LOCK_REASON });
    expect(syncComposition.services.rateLimits).toBeTruthy();
    expect(syncComposition.services.quotas).toBeTruthy();
    expect(syncComposition.services.projections).toBeTruthy();

    const approvedEnv = {
      DEVELOPER_API_CREDENTIAL_HMAC_KEY: "a".repeat(32),
      DEVELOPER_WEBHOOK_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
      DEVELOPER_API_CURSOR_HMAC_KEY: "b".repeat(32),
    };
    const fakeDb = {
      systemSetting: {
        findUnique: async ({ where }: { where: { key: string } }) =>
          where.key === DEVELOPER_API_ACTIVATION_SETTING_KEY
            ? {
                value: {
                  status: "APPROVED",
                  requestedByUserId: "maker-1",
                  requestedAt: "2026-11-24T08:00:00.000Z",
                  reason: "Consolidated Developer API validation signoff",
                  approvedByUserId: "checker-2",
                  approvedAt: "2026-11-24T09:00:00.000Z",
                  approvalNote: "Verified live secrets and endpoints",
                  revokedByUserId: null,
                  revokedAt: null,
                  version: 2,
                },
              }
            : null,
      },
    };
    const readyComposition = await resolveDeveloperApiProductionCompositionAsync({
      db: fakeDb,
      env: approvedEnv,
      now: new Date("2026-11-24T10:00:00.000Z"),
    });
    expect(readyComposition.status).toBe("READY");

    const selfApprovedComposition = await resolveDeveloperApiProductionCompositionAsync({
      db: {
        systemSetting: {
          findUnique: async () => ({
            value: {
              status: "APPROVED",
              requestedByUserId: "same-user",
              requestedAt: "2026-11-24T08:00:00.000Z",
              reason: "Attempted self approval",
              approvedByUserId: "same-user",
              approvedAt: "2026-11-24T09:00:00.000Z",
              approvalNote: "Invalid",
              revokedByUserId: null,
              revokedAt: null,
              version: 2,
            },
          }),
        },
      },
      env: approvedEnv,
      now: new Date("2026-11-24T10:00:00.000Z"),
    });
    expect(selfApprovedComposition.status).toBe("LOCKED");
    expect(selfApprovedComposition).toMatchObject({ code: DEVELOPER_API_PRODUCTION_LOCK_REASON });
  });
});
