import {
  readGovernedModuleActivation,
  requestModuleActivation,
  reviewModuleActivation,
  type ActivationDbClient,
  type GovernedModuleActivationState,
} from "@/lib/governance/module-activation";
import { cloudinaryImageConfig } from "@/lib/media/cloudinary-image-storage";
import { parseS3ConfigFromEnv, type S3EnvSource } from "@/lib/storage/s3-sigv4";

export const REPORTING_ACTIVATION_SETTING_KEY = "reporting.production_activation_approval" as const;

export function reportingRuntimeStorageStatus(
  env: S3EnvSource = process.env,
): Readonly<{ configured: boolean; provider: "s3" | "cloudinary" | "local" | "unconfigured"; blockerCode: string; summary: string }> {
  const mode = env.REPORT_ARTIFACT_STORAGE?.trim().toLowerCase();
  if (mode === "s3") {
    const s3 = parseS3ConfigFromEnv("REPORT_ARTIFACT_S3", { defaultRegion: "auto", env });
    if (s3) {
      return Object.freeze({
        configured: true,
        provider: "s3",
        blockerCode: "",
        summary: "Durable S3-compatible private report storage is configured.",
      });
    }
    return Object.freeze({
      configured: false,
      provider: "s3",
      blockerCode: "REPORT_ARTIFACT_STORAGE_UNCONFIGURED",
      summary: "REPORT_ARTIFACT_STORAGE is 's3', but S3 endpoint, bucket, region, or credentials are incomplete or invalid.",
    });
  }
  if (mode === "cloudinary") {
    if (cloudinaryImageConfig(env) !== null) {
      return Object.freeze({
        configured: true,
        provider: "cloudinary",
        blockerCode: "",
        summary: "Durable Cloudinary authenticated raw report storage is configured.",
      });
    }
    return Object.freeze({
      configured: false,
      provider: "cloudinary",
      blockerCode: "REPORT_ARTIFACT_STORAGE_UNCONFIGURED",
      summary: "REPORT_ARTIFACT_STORAGE is 'cloudinary', but Cloudinary credentials are incomplete.",
    });
  }
  return Object.freeze({
    configured: false,
    provider: mode === "local" ? "local" : "unconfigured",
    blockerCode: "REPORT_DURABLE_STORAGE_REQUIRED",
    summary: "Durable private report storage (S3-compatible or authenticated Cloudinary) is required in production.",
  });
}

export async function resolveReportingActivationState(
  options: Readonly<{ db?: ActivationDbClient; env?: S3EnvSource; now?: Date }> = {},
): Promise<GovernedModuleActivationState> {
  const runtime = reportingRuntimeStorageStatus(options.env);
  return readGovernedModuleActivation("REPORTING", runtime, {
    db: options.db,
    now: options.now,
  });
}

export async function requestReportingActivation(
  actorUserId: string,
  input: Readonly<{ expectedVersion: number; reason: string }>,
  options: Readonly<{ env?: S3EnvSource; now?: Date }> = {},
): Promise<GovernedModuleActivationState> {
  return requestModuleActivation(
    actorUserId,
    { moduleKey: "REPORTING", ...input },
    {
      runtimeCheck: () => reportingRuntimeStorageStatus(options.env),
      now: options.now,
    },
  );
}

export async function reviewReportingActivation(
  reviewerUserId: string,
  input: Readonly<{ expectedVersion: number; action: "APPROVE" | "REVOKE"; reason: string }>,
  options: Readonly<{ env?: S3EnvSource; now?: Date }> = {},
): Promise<GovernedModuleActivationState> {
  return reviewModuleActivation(
    reviewerUserId,
    { moduleKey: "REPORTING", ...input },
    {
      runtimeCheck: () => reportingRuntimeStorageStatus(options.env),
      now: options.now,
    },
  );
}
