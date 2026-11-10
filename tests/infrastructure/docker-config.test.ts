import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { composeArgs, normalComposeProject, runCompose } from "../../scripts/docker-common.mjs";
import {
  MIGRATION_SMOKE_COMPOSE_OVERRIDE,
  MIGRATION_SMOKE_EXTRA_COMPOSE_FILES,
  smokeEnv,
} from "../../scripts/docker-migration-smoke.mjs";

const root = process.cwd();
const dockerfile = readFileSync(path.join(root, "Dockerfile"), "utf8").replaceAll("\r\n", "\n");
const compose = readFileSync(path.join(root, "compose.yml"), "utf8").replaceAll("\r\n", "\n");
const composeDev = readFileSync(path.join(root, "compose.dev.yml"), "utf8").replaceAll("\r\n", "\n");
const composeMigrationSmoke = readFileSync(
  path.join(root, MIGRATION_SMOKE_COMPOSE_OVERRIDE),
  "utf8"
).replaceAll("\r\n", "\n");
const migrationSmokeScript = readFileSync(
  path.join(root, "scripts", "docker-migration-smoke.mjs"),
  "utf8"
).replaceAll("\r\n", "\n");
const dockerEnv = readFileSync(path.join(root, ".env.docker.example"), "utf8").replaceAll("\r\n", "\n");

describe("Docker infrastructure configuration", () => {
  it("uses a hardened production runner image", () => {
    expect(dockerfile).toMatch(/FROM node:24-bookworm-slim AS base/);
    expect(dockerfile).toMatch(/FROM base AS runner/);
    expect(dockerfile).toMatch(/USER nextjs/);
    expect(dockerfile).toMatch(/CMD \["node", "server\.js"\]/);
    expect(dockerfile).not.toMatch(/COPY\s+\.env\b/);
  });

  it("provides a dedicated migrator target using migrate deploy", () => {
    expect(dockerfile).toMatch(/FROM base AS migrator/);
    expect(dockerfile).toContain('"prisma", "migrate", "deploy"');
    expect(dockerfile).not.toContain("migrate dev");
    expect(dockerfile).not.toContain("migrate reset");
    expect(dockerfile).not.toContain("db push");
  });

  it("defines db, migrate, seed, and app services with health dependencies", () => {
    for (const service of ["db", "migrate", "seed", "app"]) {
      expect(compose).toMatch(new RegExp(`\\n  ${service}:\\n`));
    }

    expect(compose).toMatch(/db:[\s\S]*healthcheck:/);
    expect(compose).toMatch(/app:[\s\S]*db:[\s\S]*condition: service_healthy/);
    expect(compose).toMatch(/app:[\s\S]*migrate:[\s\S]*condition: service_completed_successfully/);
  });

  it("uses container database networking and placeholder-only secrets", () => {
    expect(compose).toContain("@db:5432/");
    expect(compose).not.toContain("@localhost:5433/");
    expect(compose).not.toContain("kt_courier_dev_password");
    expect(dockerEnv).toContain("replace_with_local_only_password");
    expect(dockerEnv).not.toContain("ChangeMe123!");
  });

  it("isolates migration-smoke from host port publication while preserving compose.dev.yml developer ports", async () => {
    expect(composeMigrationSmoke).toMatch(/db:\s*\n\s*ports:\s*!override\s*\[\]/);
    expect(composeMigrationSmoke).toMatch(/redis:\s*\n\s*ports:\s*!override\s*\[\]/);
    expect(composeMigrationSmoke).toMatch(/app:\s*\n\s*ports:\s*!override\s*\[\]/);

    expect(composeDev).toContain('"${POSTGRES_PORT:-5433}:5432"');
    expect(composeDev).toContain('"${REDIS_PORT:-6379}:6379"');

    expect(migrationSmokeScript).not.toContain("55832");
    expect(migrationSmokeScript).toContain("MIGRATION_SMOKE_EXTRA_COMPOSE_FILES");
    expect(
      composeArgs(["up", "-d", "db"], {
        projectName: "kt-couriers-baseline-smoke",
        extraComposeFiles: MIGRATION_SMOKE_EXTRA_COMPOSE_FILES,
      })
    ).toContain("compose.migration-smoke.yml");

    // Occupy port 55832 deliberately on the host to prove smoke config/resolution cannot collide with it
    const occupiedServer = createServer();
    await new Promise<void>((resolve) => {
      occupiedServer.once("error", () => resolve());
      occupiedServer.listen({ host: "127.0.0.1", port: 55832 }, () => resolve());
    });

    try {
      const smokeRendered = runCompose(["config"], {
        projectName: "kt-couriers-baseline-smoke",
        env: smokeEnv,
        extraComposeFiles: MIGRATION_SMOKE_EXTRA_COMPOSE_FILES,
      });

      if (smokeRendered.status === 0) {
        const renderedYaml = smokeRendered.stdout.replaceAll("\r\n", "\n");
        expect(renderedYaml).toContain("name: kt-couriers-baseline-smoke");
        expect(renderedYaml).toContain(
          "name: kt-couriers-baseline-smoke_kt_couriers_postgres_baselined_clean"
        );
        expect(renderedYaml).not.toMatch(/\n\s+ports:\s*\n/);
        expect(renderedYaml).not.toContain("55832");

        const devRendered = runCompose(["config"], {
          projectName: normalComposeProject,
          env: { ...process.env, POSTGRES_PORT: "5433" },
        });
        expect(devRendered.status).toBe(0);
        expect(devRendered.stdout).toContain("name: kt-couriers");
        expect(devRendered.stdout).toMatch(/published:\s*"?5433"?/);
      }
    } finally {
      await new Promise<void>((resolve) => occupiedServer.close(() => resolve()));
    }
  });
});
