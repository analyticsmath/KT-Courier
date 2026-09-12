import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const archiveDir = path.join(root, "prisma", "migrations-legacy-prebaseline");
const activeDir = path.join(root, "prisma", "migrations");

describe("legacy Prisma migration archive", () => {
  it("preserves every original migration with a verified checksum", () => {
    const manifest = JSON.parse(readFileSync(path.join(archiveDir, "manifest.json"), "utf8"));
    const expected = [
      "20260611000000_phase_2_3_address_book",
      "20260611000001_phase_2_4_driver_foundation",
      "20260611000002_phase_2_5_dispatch_assignment",
      "20260611000003_phase_2_6_pickup_custody",
      "20260611000004_phase_2_7_delivery_pod",
      "20260708000000_phase1_security_session_hardening",
      "20260708010000_phase2_employee_permissions",
      "20260710000000_phase4_database_foundation_expansion",
    ];

    expect(manifest.migrations.map((migration: { folder: string }) => migration.folder)).toEqual(expected);
    for (const migration of manifest.migrations as Array<{ folder: string; sqlFile: string; sha256: string }>) {
      const sqlPath = path.join(archiveDir, migration.folder, migration.sqlFile);
      const fileBytes = readFileSync(sqlPath);
      const rawHash = createHash("sha256").update(fileBytes).digest("hex");
      const fileText = fileBytes.toString("utf8");
      const lfHash = createHash("sha256").update(fileText.replace(/\r\n/g, "\n")).digest("hex");
      const crlfHash = createHash("sha256").update(fileText.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n")).digest("hex");
      const match = rawHash === migration.sha256 || lfHash === migration.sha256 || crlfHash === migration.sha256;
      expect(match).toBe(true);
    }
  });

  it("cannot be discovered by Prisma's active migration directory", () => {
    const active = readdirSync(activeDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    const archived = readdirSync(archiveDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    expect(active.some((name) => archived.includes(name))).toBe(false);
    expect(path.relative(activeDir, archiveDir).startsWith("..")).toBe(true);
  });
});
