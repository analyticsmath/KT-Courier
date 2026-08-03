import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Phase 28 focused scaffold audit", () => {
  it("contains no focused skip or pending marker", () => {
    const root = join(process.cwd(), "tests/phase28");
    const files = readdirSync(root).filter((name) => name.endsWith(".test.ts"));
    const source = files.map((file) => readFileSync(join(root, file), "utf8")).join("\n");
    expect(source).not.toMatch(/\.skip\s*\(/);
    expect(source).not.toMatch(new RegExp("\\bTO" + "DO\\b"));
  });
});
