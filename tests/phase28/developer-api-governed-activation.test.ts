import { describe, expect, it, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { DEVELOPER_API_ACTIVATION_SETTING_KEY, resolveDeveloperApiActivationState } from "@/lib/developer-api/activation";
import { assertDeveloperApiProductionReady } from "@/lib/developer-api/production-readiness";
import { DEVELOPER_API_PRODUCTION_LOCK_REASON } from "@/lib/developer-api/contracts";

const validEnv = {
  DEVELOPER_API_CREDENTIAL_HMAC_KEY: "credential-hmac-key-at-least-32-chars",
  DEVELOPER_WEBHOOK_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
  DEVELOPER_API_CURSOR_HMAC_KEY: "cursor-hmac-signing-key-at-least-32-c",
};

const validApprovedSetting = {
  status: "APPROVED",
  requestedByUserId: "maker-user-1",
  requestedAt: "2026-11-24T08:00:00.000Z",
  reason: "Consolidated Developer API validation signoff",
  approvedByUserId: "checker-user-2",
  approvedAt: "2026-11-24T09:00:00.000Z",
  approvalNote: "Verified keys, scopes, rate limits, and webhook SSRF controls",
  revokedByUserId: null,
  revokedAt: null,
  version: 2,
};

describe("Phase 28 Developer API governed activation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks with DEVELOPER_API_CONSOLIDATED_VALIDATION_NOT_APPROVED when approval record is missing or revoked", async () => {
    const stateMissing = await resolveDeveloperApiActivationState({
      db: { systemSetting: { findUnique: async () => null } },
      env: validEnv,
    });
    expect(stateMissing.approved).toBe(false);
    expect(stateMissing.active).toBe(false);
    expect(stateMissing.blockerCode).toBe(DEVELOPER_API_PRODUCTION_LOCK_REASON);

    await expect(
      assertDeveloperApiProductionReady({
        db: { systemSetting: { findUnique: async () => null } },
        env: validEnv,
      }),
    ).rejects.toMatchObject({
      code: DEVELOPER_API_PRODUCTION_LOCK_REASON,
      status: 423,
    });

    const stateRevoked = await resolveDeveloperApiActivationState({
      db: {
        systemSetting: {
          findUnique: async () => ({
            value: {
              ...validApprovedSetting,
              status: "REVOKED",
              revokedByUserId: "admin-3",
              revokedAt: "2026-11-24T10:00:00.000Z",
              version: 3,
            },
          }),
        },
      },
      env: validEnv,
      now: new Date("2026-11-24T11:00:00.000Z"),
    });
    expect(stateRevoked.approved).toBe(false);
    expect(stateRevoked.active).toBe(false);
  });

  it("blocks with DEVELOPER_API_SECRETS_UNCONFIGURED if approved in DB while cryptographic secrets are missing", async () => {
    const db = {
      systemSetting: {
        findUnique: async ({ where }: { where: { key: string } }) =>
          where.key === DEVELOPER_API_ACTIVATION_SETTING_KEY ? { value: validApprovedSetting } : null,
      },
    };
    const state = await resolveDeveloperApiActivationState({
      db,
      env: { DEVELOPER_API_CREDENTIAL_HMAC_KEY: "short" },
      now: new Date("2026-11-24T10:00:00.000Z"),
    });
    expect(state.approved).toBe(true);
    expect(state.runtimeConfigured).toBe(false);
    expect(state.active).toBe(false);
    expect(state.blockerCode).toBe("DEVELOPER_API_SECRETS_UNCONFIGURED");

    await expect(
      assertDeveloperApiProductionReady({
        db,
        env: {},
        now: new Date("2026-11-24T10:00:00.000Z"),
      }),
    ).rejects.toMatchObject({
      code: "DEVELOPER_API_SECRETS_UNCONFIGURED",
      status: 503,
    });
  });

  it("activates cleanly when dual-control approved and cryptographic keys are configured", async () => {
    const db = {
      systemSetting: {
        findUnique: async ({ where }: { where: { key: string } }) =>
          where.key === DEVELOPER_API_ACTIVATION_SETTING_KEY ? { value: validApprovedSetting } : null,
      },
    };
    const state = await resolveDeveloperApiActivationState({
      db,
      env: validEnv,
      now: new Date("2026-11-24T10:00:00.000Z"),
    });
    expect(state.approved).toBe(true);
    expect(state.runtimeConfigured).toBe(true);
    expect(state.active).toBe(true);
    expect(state.blockerCode).toBeNull();

    await expect(
      assertDeveloperApiProductionReady({
        db,
        env: validEnv,
        now: new Date("2026-11-24T10:00:00.000Z"),
      }),
    ).resolves.toBeUndefined();

    // Verify deterministic HMAC & webhook signing primitives can actually operate with these secrets
    const digest = createHmac("sha256", validEnv.DEVELOPER_API_CREDENTIAL_HMAC_KEY).update("kt_live_sample").digest("hex");
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
  });
});
