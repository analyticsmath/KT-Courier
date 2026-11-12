import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function collectPages(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? collectPages(path)
      : entry === "page.tsx" ? [path] : [];
  });
}

describe("protected account and vendor login fallback", () => {
  it("provides the canonical public login page", () => {
    expect(existsSync(join(process.cwd(), "app/(auth)/login/page.tsx"))).toBe(true);
  });

  it("never redirects a lost protected session to the nonexistent legacy auth/login page", () => {
    const pages = collectPages(join(process.cwd(), "app"));
    expect(pages.length).toBeGreaterThan(50);
    for (const file of pages) {
      const source = readFileSync(file, "utf8");
      expect(source, `incorrect redirect target in ${file}`).not.toMatch(/redirect\s*\(\s*["'`]\/auth\/login(?:\?[^"'`]*)?["'`]\s*\)/);
    }
  });
});
