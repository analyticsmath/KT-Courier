import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const envDocker = readFileSync(path.join(root, ".env.docker.example"), "utf8");
const compose = readFileSync(path.join(root, "compose.yml"), "utf8");
const composeDev = readFileSync(path.join(root, "compose.dev.yml"), "utf8");
const dockerignore = readFileSync(path.join(root, ".dockerignore"), "utf8");
const gitignore = readFileSync(path.join(root, ".gitignore"), "utf8");

describe("Docker environment and networking", () => {
  it("documents separate host and container database URLs", () => {
    expect(envDocker).toContain("@localhost:5433/kt_courier_dev");
    expect(envDocker).toContain("@localhost:5433/kt_courier_shadow");
    expect(envDocker).toContain("@db:5432/kt_courier_dev");
    expect(envDocker).toContain("@db:5432/kt_courier_shadow");
  });

  it("publishes PostgreSQL only through the development override", () => {
    expect(compose).not.toContain("5433:5432");
    expect(composeDev).toContain("${POSTGRES_PORT:-5433}:5432");
  });

  it("keeps real env files out of Git and Docker images while allowing templates", () => {
    expect(gitignore).toMatch(/^\.env\*/m);
    expect(gitignore).toMatch(/^!\.env\.example/m);
    expect(gitignore).toMatch(/^!\.env\.docker\.example/m);

    expect(dockerignore).toMatch(/^\.env$/m);
    expect(dockerignore).toMatch(/^\.env\.\*$/m);
    expect(dockerignore).toMatch(/^!\.env\.example$/m);
    expect(dockerignore).toMatch(/^!\.env\.docker\.example$/m);
  });
});
