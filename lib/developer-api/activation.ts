import {
  readGovernedModuleActivation,
  requestModuleActivation,
  reviewModuleActivation,
  type ActivationDbClient,
  type GovernedModuleActivationState,
} from "@/lib/governance/module-activation";

export const DEVELOPER_API_ACTIVATION_SETTING_KEY = "developer_api.production_activation_approval" as const;

export type EnvSource = Readonly<Record<string, string | undefined>>;

function validHmacKey(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length >= 32;
}

function validWebhookAesKey(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return Buffer.from(value, "base64").length === 32;
  } catch {
    return false;
  }
}

export function developerApiRuntimeSecretStatus(
  env: EnvSource = process.env,
): Readonly<{ configured: boolean; blockerCode: string; summary: string; missingKeys: readonly string[] }> {
  const missingKeys: string[] = [];
  if (!validHmacKey(env.DEVELOPER_API_CREDENTIAL_HMAC_KEY)) missingKeys.push("DEVELOPER_API_CREDENTIAL_HMAC_KEY");
  if (!validWebhookAesKey(env.DEVELOPER_WEBHOOK_ENCRYPTION_KEY)) missingKeys.push("DEVELOPER_WEBHOOK_ENCRYPTION_KEY");
  if (!validHmacKey(env.DEVELOPER_API_CURSOR_HMAC_KEY)) missingKeys.push("DEVELOPER_API_CURSOR_HMAC_KEY");

  if (missingKeys.length === 0) {
    return Object.freeze({
      configured: true,
      blockerCode: "",
      summary: "Developer API cryptographic HMAC and webhook encryption keys are configured.",
      missingKeys: [],
    });
  }
  return Object.freeze({
    configured: false,
    blockerCode: "DEVELOPER_API_SECRETS_UNCONFIGURED",
    summary: `Missing or invalid developer API secrets: ${missingKeys.join(", ")}.`,
    missingKeys: Object.freeze(missingKeys),
  });
}

export async function resolveDeveloperApiActivationState(
  options: Readonly<{ db?: ActivationDbClient; env?: EnvSource; now?: Date }> = {},
): Promise<GovernedModuleActivationState> {
  const runtime = developerApiRuntimeSecretStatus(options.env);
  return readGovernedModuleActivation("DEVELOPER_API", runtime, {
    db: options.db,
    now: options.now,
  });
}

export async function requestDeveloperApiActivation(
  actorUserId: string,
  input: Readonly<{ expectedVersion: number; reason: string }>,
  options: Readonly<{ env?: EnvSource; now?: Date }> = {},
): Promise<GovernedModuleActivationState> {
  return requestModuleActivation(
    actorUserId,
    { moduleKey: "DEVELOPER_API", ...input },
    {
      runtimeCheck: () => developerApiRuntimeSecretStatus(options.env),
      now: options.now,
    },
  );
}

export async function reviewDeveloperApiActivation(
  reviewerUserId: string,
  input: Readonly<{ expectedVersion: number; action: "APPROVE" | "REVOKE"; reason: string }>,
  options: Readonly<{ env?: EnvSource; now?: Date }> = {},
): Promise<GovernedModuleActivationState> {
  return reviewModuleActivation(
    reviewerUserId,
    { moduleKey: "DEVELOPER_API", ...input },
    {
      runtimeCheck: () => developerApiRuntimeSecretStatus(options.env),
      now: options.now,
    },
  );
}
