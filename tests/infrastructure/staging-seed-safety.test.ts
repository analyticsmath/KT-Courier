import { describe, it, expect } from "vitest";
import { validateStagingSeedSafety } from "@/scripts/seed-staging-demo";

describe("Safe Staging Database Provisioner Invariants", () => {
  const validStagingEnv = {
    KT_RUNTIME_ENV: "staging-demo",
    KT_STAGING_DEMO_ENABLED: "true",
    KT_DATABASE_CLASSIFICATION: "staging",
    KT_ALLOW_DEMO_SEED: "true",
    DATABASE_URL: "postgresql://postgres:pass@staging-db.internal:5432/kt_courier_staging_demo",
  };

  it("passes validation with canonical dedicated staging demo environment", () => {
    const result = validateStagingSeedSafety(validStagingEnv);
    expect(result.valid).toBe(true);
    expect(result.dbName).toBe("kt_courier_staging_demo");
  });

  it("refuses seed if KT_RUNTIME_ENV is not staging-demo", () => {
    expect(() =>
      validateStagingSeedSafety({
        ...validStagingEnv,
        KT_RUNTIME_ENV: "production",
      }),
    ).toThrow(/KT_RUNTIME_ENV must be explicitly 'staging-demo'/i);
  });

  it("refuses seed if KT_STAGING_DEMO_ENABLED is not true", () => {
    expect(() =>
      validateStagingSeedSafety({
        ...validStagingEnv,
        KT_STAGING_DEMO_ENABLED: "false",
      }),
    ).toThrow(/KT_STAGING_DEMO_ENABLED must be 'true'/i);
  });

  it("refuses seed if KT_DATABASE_CLASSIFICATION is not staging", () => {
    expect(() =>
      validateStagingSeedSafety({
        ...validStagingEnv,
        KT_DATABASE_CLASSIFICATION: "production",
      }),
    ).toThrow(/KT_DATABASE_CLASSIFICATION must be explicitly 'staging'/i);
  });

  it("refuses seed without explicit authorization flag KT_ALLOW_DEMO_SEED=true", () => {
    expect(() =>
      validateStagingSeedSafety({
        ...validStagingEnv,
        KT_ALLOW_DEMO_SEED: "false",
      }),
    ).toThrow(/KT_ALLOW_DEMO_SEED must be explicitly set to 'true'/i);
  });

  it("refuses seed against primary production database name", () => {
    expect(() =>
      validateStagingSeedSafety({
        ...validStagingEnv,
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/kt_courier",
      }),
    ).toThrow(/Refusing staging seed on primary\/reserved database 'kt_courier'/i);
  });

  it("refuses seed against primary staging database name (kt_courier_staging)", () => {
    expect(() =>
      validateStagingSeedSafety({
        ...validStagingEnv,
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/kt_courier_staging",
      }),
    ).toThrow(/Refusing staging seed on primary\/reserved database 'kt_courier_staging'/i);
  });

  it("refuses seed against primary development database name (kt_courier_dev)", () => {
    expect(() =>
      validateStagingSeedSafety({
        ...validStagingEnv,
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/kt_courier_dev",
      }),
    ).toThrow(/Refusing staging seed on primary\/reserved database 'kt_courier_dev'/i);
  });

  it("refuses seed against arbitrary unapproved database names", () => {
    expect(() =>
      validateStagingSeedSafety({
        ...validStagingEnv,
        DATABASE_URL: "postgresql://postgres:pass@localhost:5432/my_random_db",
      }),
    ).toThrow(/does not match dedicated staging demo database pattern/i);
  });

  it("refuses seed against suspected production hostnames", () => {
    expect(() =>
      validateStagingSeedSafety({
        ...validStagingEnv,
        DATABASE_URL: "postgresql://postgres:pass@rds.amazonaws.com:5432/kt_courier_staging_demo",
      }),
    ).toThrow(/Refusing staging seed against suspected production host/i);
  });
});
