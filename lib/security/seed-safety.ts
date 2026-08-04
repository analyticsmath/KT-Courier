export type DatabaseClassification = "development" | "test" | "staging" | "production";

export interface SeedSafetyInput {
  nodeEnv?: string;
  classification?: string;
  allowDemoSeed?: string | boolean;
  dbUrl?: string;
}

export class SeedSafetyError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "SeedSafetyError";
  }
}

/**
 * Asserts whether database seeding is permitted based on environment variables.
 * Fails closed in production, staging, ambiguous environments, or when explicit authorization is missing.
 * Never prints connection strings or passwords in errors.
 */
export function assertSeedExecutionAllowed(input?: SeedSafetyInput): void {
  const nodeEnv = input?.nodeEnv ?? process.env.NODE_ENV;
  const rawClassification = input?.classification ?? process.env.KT_DATABASE_CLASSIFICATION ?? "development";
  const classification = rawClassification.toLowerCase();
  const allowDemo = input?.allowDemoSeed ?? process.env.KT_ALLOW_DEMO_SEED;

  // 1. Refuse in production NODE_ENV
  if (nodeEnv === "production") {
    throw new SeedSafetyError("SEED_REJECTED_PRODUCTION_ENV", "Seed execution is strictly prohibited when NODE_ENV is production.");
  }

  // 2. Refuse when database classification is production
  if (classification === "production") {
    throw new SeedSafetyError("SEED_REJECTED_PRODUCTION_CLASSIFICATION", "Seed execution is strictly prohibited for production databases.");
  }

  // 3. Refuse when database classification is staging by default
  if (classification === "staging") {
    throw new SeedSafetyError("SEED_REJECTED_STAGING_CLASSIFICATION", "Seed execution is prohibited for staging databases by default.");
  }

  // 4. Validate classification value
  if (classification !== "development" && classification !== "test") {
    throw new SeedSafetyError(
      "SEED_REJECTED_AMBIGUOUS_CLASSIFICATION",
      `Ambiguous or unrecognized database classification: '${rawClassification}'.`
    );
  }

  // 5. Require explicit demo seed authorization (or NODE_ENV=test)
  const isTest = nodeEnv === "test" || classification === "test";
  const isAuthorized = allowDemo === true || allowDemo === "true" || allowDemo === "1";

  if (!isTest && !isAuthorized) {
    throw new SeedSafetyError(
      "SEED_REJECTED_UNAUTHORIZED",
      "Seed execution requires explicit authorization (set KT_ALLOW_DEMO_SEED=true)."
    );
  }
}
