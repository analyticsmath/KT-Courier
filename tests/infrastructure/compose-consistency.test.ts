import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const compose = readFileSync(path.join(root, "compose.yml"), "utf8").replaceAll("\r\n", "\n");
const composeDev = readFileSync(path.join(root, "compose.dev.yml"), "utf8").replaceAll("\r\n", "\n");
const legacyCompose = readFileSync(path.join(root, "docker-compose.dev.yml"), "utf8").replaceAll("\r\n", "\n");

describe("Compose configuration consistency", () => {
  it("uses the canonical db service, new baselined volume, and host/container port split", () => {
    expect(compose).toMatch(/\n  db:\n/);
    expect(compose).toContain("kt_couriers_postgres_baselined_clean:/var/lib/postgresql/data");
    expect(compose).not.toContain("kt_couriers_postgres_data:/var/lib/postgresql/data");
    expect(compose).toContain("@db:5432/");
    expect(composeDev).toContain("${POSTGRES_PORT:-5433}:5432");
  });

  it("keeps the legacy filename as a non-conflicting compatibility include", () => {
    expect(legacyCompose).toContain("compose.yml");
    expect(legacyCompose).toContain("compose.dev.yml");
    expect(legacyCompose).not.toMatch(/^services:/m);
    expect(legacyCompose).not.toContain("POSTGRES_PORT");
    expect(legacyCompose).not.toContain("DATABASE_URL");
  });
});
