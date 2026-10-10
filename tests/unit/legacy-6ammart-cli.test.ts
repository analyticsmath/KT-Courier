import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = mkdtempSync(path.join(tmpdir(), "kt-legacy-cli-"));
const source = path.join(root, "source.json");
writeFileSync(source, JSON.stringify({ packageVersion: 1,
  source: { system: "LEGACY_6AMMART", database: "wwwktcouriers_ktcouaielidb", dumpSha256: "a".repeat(64) },
  tables: { vendors: [], categories: [], stores: [{ id: 21, name: "Real merchant", status: 1, active: 1 }],
    items: [
      { id: 1, store_id: 21, status: 1, is_approved: 1, price: 100, image: "valid.png" },
      { id: 2, store_id: 21, status: 1, is_approved: 1, price: 100, image: "empty.png" },
      { id: 3, store_id: 999, status: 1, is_approved: 1, price: 100, image: "valid.png" },
      { id: 4, store_id: 21, status: 1, is_approved: 1, price: 9995, image: "valid.png", variations: [{ type: "METAL", price: 0, stock: 0 }] },
    ] },
  media: { "valid.png": { exists: true, byteSize: 50, zeroByte: false }, "empty.png": { exists: true, byteSize: 0, zeroByte: true } },
}));
afterAll(() => rmSync(root, { recursive: true, force: true }));
function run(extra: string[] = []) {
  return spawnSync(process.execPath, ["--import", "tsx", "scripts/legacy-6ammart/import-catalog-core.ts", "--source", source, ...extra], {
    cwd: process.cwd(), encoding: "utf8", timeout: 30_000,
    env: { ...process.env, DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/unreachable", KT_DATABASE_CLASSIFICATION: "", KT_LEGACY_6AMMART_PRODUCTION_APPROVED: "" },
  });
}
describe("legacy importer command boundary", () => {
  it("defaults to a database-free dry run with independent admission counts", () => {
    const result = run();
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ mode: "dry-run", stores: { total: 1, publish: 1 }, products: { total: 4, publish: 1, pending: 2, orphan: 1, invalidPrice: 1 } });
  });
  it("rejects an unclassified apply before any database connection", () => {
    const result = run(["--apply"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("explicit database classification");
    expect(result.stderr).not.toContain("Can't reach database");
  });
});
