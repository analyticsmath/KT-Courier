import type { ActivationDbClient } from "@/lib/governance/module-activation";
import { isActualProductionInstance } from "@/lib/promotions/production-lock";
import type { S3EnvSource } from "@/lib/storage/s3-sigv4";
import { resolveReportingActivationState, reportingRuntimeStorageStatus } from "./activation";
import {
  REPORTING_PRODUCTION_LOCK_REASON,
  ReportingError,
} from "./contracts";

export {
  REPORTING_PRODUCTION_LOCK_REASON,
  resolveReportingActivationState,
  reportingRuntimeStorageStatus,
};

export async function assertReportingProductionReady(
  options: Readonly<{ db?: ActivationDbClient; env?: S3EnvSource; now?: Date; requireGovernanceInNonProd?: boolean }> = {},
): Promise<void> {
  const env = options.env ?? process.env;
  const isProduction =
    env.VERCEL_ENV === "production" ||
    env.RAILWAY_ENVIRONMENT_NAME === "production" ||
    isActualProductionInstance(env);
  const state = await resolveReportingActivationState(options);

  if (isProduction || options.requireGovernanceInNonProd || env.KT_ENFORCE_GOVERNED_ACTIVATION === "true" || state.recordExists) {
    if (!state.approved) {
      throw new ReportingError(
        REPORTING_PRODUCTION_LOCK_REASON,
        423,
        "Live reporting workflows require independent dual-control admin activation approval.",
      );
    }
    if (isProduction && !state.runtimeConfigured) {
      throw new ReportingError(
        state.blockerCode ?? "REPORT_DURABLE_STORAGE_REQUIRED",
        503,
        state.summary,
      );
    }
  }
}
