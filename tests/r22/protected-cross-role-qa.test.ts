import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (relative: string) => readFileSync(join(root, relative), "utf8");

const pageRoots = [
  "app/(account)",
  "app/(admin)",
  "app/(applicant)",
  "app/(customer)",
  "app/(driver)",
  "app/(payments)",
  "app/(promoter)",
  "app/(store)",
];

function pagesIn(dir: string): string[] {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  const entries = readdirSync(abs);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(abs, entry);
    const rel = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...pagesIn(rel));
    } else if (entry === "page.tsx") {
      files.push(rel.replace(/\\/g, "/"));
    }
  }
  return files;
}

describe("R22 protected cross-role QA contracts", () => {
  const protectedPages = pageRoots.flatMap(pagesIn);

  it("inventories every current protected or candidate-private route module", () => {
    expect(protectedPages.length).toBeGreaterThanOrEqual(242);
    expect(protectedPages.every((p) => existsSync(join(root, p)))).toBe(true);
    expect(source("docs/frontend/r22-route-coverage-matrix.md")).toContain("protected/private route modules");
  });

  it("keeps protected page bodies within a protected-v2 boundary", () => {
    const paymentPages = protectedPages.filter((file) => file.startsWith("app/(payments)"));
    const nonPaymentPages = protectedPages.filter((file) => !file.startsWith("app/(payments)"));
    expect(nonPaymentPages.every((file) => source(file).includes("@/components/protected-v2"))).toBe(true);
    expect(paymentPages.every((file) => source(file).includes("@/components/protected-v2"))).toBe(true);
    const remediatedPages = [
      "app/(admin)/admin/delivery-exceptions/page.tsx",
      "app/(admin)/admin/pickup-exceptions/page.tsx",
      ...paymentPages,
    ].map(source).join("\n");
    expect(remediatedPages).not.toMatch(/@\/components\/ui\/(PageHeader|Card)/);
  });

  it("keeps public, protected developer, applicant, and role shells structurally separate", () => {
    expect(source("app/(public)/layout.tsx")).toContain("PublicVisualRoot");
    expect(source("app/(account)/developers/page.tsx")).not.toContain("EditorialOperationsShell");
    expect(source("app/(account)/developers/[...segments]/layout.tsx")).toContain("EditorialOperationsShell");
    expect(source("app/(applicant)/applicant/layout.tsx")).toContain("CandidateDossierShell");
  });
});
