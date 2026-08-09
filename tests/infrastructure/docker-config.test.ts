import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const dockerfile = readFileSync(path.join(root, "Dockerfile"), "utf8").replaceAll("\r\n", "\n");
const compose = readFileSync(path.join(root, "compose.yml"), "utf8").replaceAll("\r\n", "\n");
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
});
