import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { signatureMedia } from "@/components/public-v2/home/signature-media";

const workspaceRoot = process.cwd();
const source = (file: string) => readFileSync(path.join(workspaceRoot, file), "utf8");
const rejectedMediaNames = [
  "a01-commerce-world.webp",
  "a02-commerce-threshold.webp",
  "a03-cape-town-merchant.webp",
  "a04-product-tactile.webp",
  "a05-commerce-handoff.webp",
  "a06-commerce-in-motion.webp",
  "a07-cape-town-abundance.webp",
  "a08-craft-discovery.webp",
] as const;

describe("frontend signature media contract", () => {
  it("keeps rejected home-v4 binaries out of compile-time imports", () => {
    const frontendSources = [
      source("components/public-v2/home/signature-media.ts"),
      source("components/public-v2/home/SignatureHomepage.tsx"),
      source("components/public-v2/home/SignatureHomepageKeyframes.tsx"),
      source("components/public-v2/lab/VisualLab.tsx"),
    ].join("\n");

    expect(frontendSources).not.toMatch(/(?:from\s+["'][^"']*home-v4|import\s*\(\s*["'][^"']*home-v4)/);
    for (const name of rejectedMediaNames) expect(frontendSources).not.toContain(name);
  });

  it("preserves all semantic slots as explicitly unassigned frontend media", () => {
    expect(Object.keys(signatureMedia)).toEqual(["world", "threshold", "merchant", "tactile", "handoff", "movement", "abundance", "discovery"]);
    for (const [key, media] of Object.entries(signatureMedia)) {
      expect(media.slot).toBe(key);
      expect(media.image).toBeNull();
      expect(media.status).toBe("PENDING_FRONTEND_MEDIA");
      expect(media.alt).not.toBe("");
      expect(media.objectPosition).not.toBe("");
    }
  });

  it("guards every current media consumer before rendering next/image", () => {
    for (const file of [
      "components/public-v2/home/SignatureHomepage.tsx",
      "components/public-v2/home/SignatureHomepageKeyframes.tsx",
      "components/public-v2/lab/VisualLab.tsx",
    ]) {
      expect(source(file)).toContain("media.image ? <Image");
    }
  });

  it("resolves every current local static image import", () => {
    const missingImports: string[] = [];
    for (const file of collectSourceFiles(["app", "components", "lib", "scripts", "tests"])) {
      const contents = source(file);
      for (const match of contents.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+\.(?:avif|gif|jpe?g|png|svg|webp))["']/gi)) {
        const specifier = match[1];
        if (specifier.startsWith("http://") || specifier.startsWith("https://")) continue;
        const assetPath = specifier.startsWith("@/")
          ? path.join(workspaceRoot, specifier.slice(2))
          : path.resolve(path.dirname(path.join(workspaceRoot, file)), specifier);
        if (!existsSync(assetPath)) missingImports.push(`${file} -> ${specifier}`);
      }
    }
    expect(missingImports).toEqual([]);
  });
});

function collectSourceFiles(directories: string[]): string[] {
  const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);
  const ignoredDirectories = new Set([".next", "coverage", "node_modules", "output"]);

  const visit = (relativeDirectory: string): string[] => readdirSync(path.join(workspaceRoot, relativeDirectory), { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) return [];
      return visit(path.join(relativeDirectory, entry.name));
    }
    const extension = path.extname(entry.name).toLowerCase();
    return sourceExtensions.has(extension) ? [path.join(relativeDirectory, entry.name)] : [];
  });

  return directories.flatMap(visit);
}
