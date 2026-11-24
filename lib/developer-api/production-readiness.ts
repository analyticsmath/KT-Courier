import type { ActivationDbClient } from "@/lib/governance/module-activation";
import { resolveDeveloperApiActivationState, developerApiRuntimeSecretStatus, type EnvSource } from "./activation";
import { DEVELOPER_API_PRODUCTION_LOCK_REASON, DeveloperApiError } from "./contracts";

export {
  DEVELOPER_API_PRODUCTION_LOCK_REASON,
  resolveDeveloperApiActivationState,
  developerApiRuntimeSecretStatus,
};

export async function assertDeveloperApiProductionReady(
  options: Readonly<{ db?: ActivationDbClient; env?: EnvSource; now?: Date }> = {},
): Promise<void> {
  const state = await resolveDeveloperApiActivationState(options);
  if (!state.approved) {
    throw new DeveloperApiError(
      DEVELOPER_API_PRODUCTION_LOCK_REASON,
      423,
      "The live developer API requires independent dual-control admin activation approval.",
    );
  }
  if (!state.runtimeConfigured) {
    throw new DeveloperApiError(
      state.blockerCode ?? "DEVELOPER_API_SECRETS_UNCONFIGURED",
      503,
      state.summary,
    );
  }
}
