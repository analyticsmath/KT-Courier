import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertDisposableSmokeIdentity,
  getDisposableSmokeSeedComposeArgs,
  normalComposeProject,
} from "../../scripts/docker-common.mjs";
import { assertSeedExecutionAllowed, SeedSafetyError } from "../../lib/security/seed-safety";

const root = process.cwd();
const migrationSmokeScript = readFileSync(path.join(root, "scripts", "docker-migration-smoke.mjs"), "utf8");
const dockerSmokeScript = readFileSync(path.join(root, "scripts", "docker-smoke.mjs"), "utf8");

describe("Disposable smoke seed authorization & identity", () => {
  describe("getDisposableSmokeSeedComposeArgs helper", () => {
    it("returns explicit seed authorization compose argument array", () => {
      const args = getDisposableSmokeSeedComposeArgs();
      expect(args).toEqual(["run", "--rm", "-e", "KT_ALLOW_DEMO_SEED=true", "seed"]);
    });

    it("supports custom service and command options while preserving authorization flag", () => {
      const args = getDisposableSmokeSeedComposeArgs({
        service: "migrate",
        command: ["npx", "prisma", "db", "seed"],
      });
      expect(args).toEqual([
        "run",
        "--rm",
        "-e",
        "KT_ALLOW_DEMO_SEED=true",
        "migrate",
        "npx",
        "prisma",
        "db",
        "seed",
      ]);
    });

    it("does not leak environment secrets or append unrequested host env vars", () => {
      const args = getDisposableSmokeSeedComposeArgs();
      expect(args.join(" ")).not.toMatch(/DATABASE_URL|POSTGRES_PASSWORD|RESEND_API_KEY|STRIPE_SECRET_KEY|AUTH_SECRET/);
      expect(args).toHaveLength(5);
      expect(args[3]).toBe("KT_ALLOW_DEMO_SEED=true");
    });
  });

  describe("assertDisposableSmokeIdentity helper", () => {
    const validEnv: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      POSTGRES_DB: "kt_courier_baseline_smoke",
      DATABASE_URL: "postgresql://kt_courier_baseline_smoke:pass@db:5432/kt_courier_baseline_smoke?schema=public",
    };

    it("accepts valid disposable smoke project and database identity", () => {
      expect(() =>
        assertDisposableSmokeIdentity("kt-couriers-baseline-smoke", validEnv)
      ).not.toThrow();
    });

    it("rejects non-disposable normal project name", () => {
      expect(() =>
        assertDisposableSmokeIdentity(normalComposeProject, validEnv)
      ).toThrow(/Refusing seed authorization for non-disposable Compose project/);
    });

    it("rejects non-disposable database name", () => {
      expect(() =>
        assertDisposableSmokeIdentity("kt-couriers-baseline-smoke", {
          ...validEnv,
          POSTGRES_DB: "kt_courier_production",
        })
      ).toThrow(/Refusing seed authorization for non-disposable database/);
    });

    it("rejects remote database hosts in DATABASE_URL", () => {
      expect(() =>
        assertDisposableSmokeIdentity("kt-couriers-baseline-smoke", {
          ...validEnv,
          DATABASE_URL: "postgresql://user:pass@remote-db.example.invalid:5432/kt_courier_baseline_smoke",
        })
      ).toThrow(/Refusing seed authorization for non-local database host/);
    });
  });

  describe("Seed fail-closed authorization policy", () => {
    const invalidAuthValues = [undefined, "", "false", "0", "no", "invalid", "OFF", "disabled"];

    it.each(invalidAuthValues)("rejects seed execution when allowDemoSeed is '%s'", (value) => {
      expect(() =>
        assertSeedExecutionAllowed({
          nodeEnv: "development",
          classification: "development",
          allowDemoSeed: value,
        })
      ).toThrowError(SeedSafetyError);

      try {
        assertSeedExecutionAllowed({
          nodeEnv: "development",
          classification: "development",
          allowDemoSeed: value,
        });
      } catch (err) {
        expect(err).toBeInstanceOf(SeedSafetyError);
        expect((err as SeedSafetyError).code).toBe("SEED_REJECTED_UNAUTHORIZED");
      }
    });

    it("allows seed execution only when allowDemoSeed is explicitly authorized", () => {
      for (const validValue of ["true", true, "1"]) {
        expect(() =>
          assertSeedExecutionAllowed({
            nodeEnv: "development",
            classification: "development",
            allowDemoSeed: validValue,
          })
        ).not.toThrow();
      }
    });
  });

  describe("Smoke scripts static integration contract", () => {
    it("docker-migration-smoke.mjs uses the authorized helper and identity check for both seed passes", () => {
      expect(migrationSmokeScript).toContain("getDisposableSmokeSeedComposeArgs");
      expect(migrationSmokeScript).toContain("assertDisposableSmokeIdentity");
      expect(migrationSmokeScript).toMatch(/First disposable smoke seed authorization: ENABLED/);
      expect(migrationSmokeScript).toMatch(/Second disposable smoke seed authorization: ENABLED/);
    });

    it("docker-smoke.mjs uses the authorized helper and identity check for both seed passes", () => {
      expect(dockerSmokeScript).toContain("getDisposableSmokeSeedComposeArgs");
      expect(dockerSmokeScript).toContain("assertDisposableSmokeIdentity");
      expect(dockerSmokeScript).toMatch(/First disposable smoke seed authorization: ENABLED/);
      expect(dockerSmokeScript).toMatch(/Second disposable smoke seed authorization: ENABLED/);
    });

    it("restricts cleanup to disposable project kt-couriers-baseline-smoke and avoids global prunes", () => {
      expect(migrationSmokeScript).toContain('const projectName = process.env.KT_SMOKE_PROJECT_NAME || "kt-couriers-baseline-smoke";');
      expect(migrationSmokeScript).not.toMatch(/docker (?:system|volume) prune/);
      expect(dockerSmokeScript).not.toMatch(/docker (?:system|volume) prune/);
    });
  });
});
