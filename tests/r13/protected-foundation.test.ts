import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PROTECTED_CONTEXTS_BY_ROLE,
  PROTECTED_NAVIGATION_REGISTRY,
  projectProtectedNavigation,
} from "@/lib/protected-navigation";
import { PROTECTED_ILLUSTRATIONS } from "@/components/protected-v2/illustrations/illustration-registry";

const workspaceRoot = process.cwd();
const readSource = (file: string) => readFileSync(path.join(workspaceRoot, file), "utf8");

function routeExists(href: string): boolean {
  const staticCandidates: Record<string, string> = {
    "/account": "app/(account)/account/page.tsx",
    "/store": "app/(store)/store/page.tsx",
    "/driver": "app/(driver)/driver/page.tsx",
    "/promoter": "app/(account)/promoter/page.tsx",
    "/developers": "app/(account)/developers/page.tsx",
    "/admin": "app/(admin)/admin/page.tsx",
  };
  if (staticCandidates[href]) return true;
  if (href.startsWith("/developers/")) return true; // owned by the required protected catch-all route
  if (href.startsWith("/admin/developers")) return true; // owned by the optional catch-all route

  const [context, ...segments] = href.slice(1).split("/");
  const prefixByContext: Record<string, string | undefined> = {
    account: "app/(account)/account",
    store: "app/(store)/store",
    driver: "app/(driver)/driver",
    promoter: "app/(account)/promoter",
    admin: "app/(admin)/admin",
  };
  const prefix = prefixByContext[context];
  return Boolean(prefix && readFileExists(path.join(prefix, ...segments, "page.tsx")));
}

function readFileExists(file: string): boolean {
  try {
    readFileSync(path.join(workspaceRoot, file), "utf8");
    return true;
  } catch {
    return false;
  }
}

describe("R13 protected Editorial Operations foundation", () => {
  it("scopes the visual root and its tokens without changing public selectors", () => {
    const root = readSource("components/protected-v2/foundation/ProtectedVisualRoot.tsx");
    const css = readSource("app/globals.css");
    expect(root).toContain('data-kt-protected-system="editorial-operations-v1"');
    expect(css).toContain('[data-kt-protected-system="editorial-operations-v1"]');
    expect(css).toContain('--eo-canvas: #f5f7f5');
    expect(css).toContain('[data-kt-visual-system="editorial-freight-v1"]');
  });

  it("uses only local protected font sources and preserves a server-first shell", () => {
    const fonts = readSource("app/fonts/protected-fonts.ts");
    const shell = readSource("components/protected-v2/shell/EditorialOperationsShell.tsx");
    expect(fonts).toContain('next/font/local');
    expect(fonts).toContain('MonaSansVF[wdth,opsz,wght].woff2');
    expect(fonts).toContain('Newsreader[opsz,wght].woff2');
    expect(fonts).not.toMatch(/https?:\/\//);
    expect(shell).not.toContain('"use client"');
    expect(shell).toContain('id="protected-main-content"');
  });

  it("keeps prohibited visual treatments out of the R13 namespace", () => {
    const protectedSources = [
      ...["components/protected-v2", "lib/protected-navigation", "lib/protected-presentation"].flatMap((directory) => collectSources(directory)),
      "app/fonts/protected-fonts.ts",
    ].map(readSource).join("\n");
    const css = readSource("app/globals.css");
    const r13Start = css.indexOf("R13 Editorial Operations");
    const firstR13Css = css.slice(r13Start, css.indexOf("\n:root", r13Start));
    const secondR13Css = css.slice(css.lastIndexOf("@layer components"));
    const r13Css = `${firstR13Css}\n${secondR13Css}`;
    expect(protectedSources).not.toMatch(/\bgsap\b/i);
    expect(protectedSources).not.toMatch(/linearGradient|radialGradient|<text\b/);
    expect(r13Css).not.toMatch(/linear-gradient|radial-gradient|backdrop-filter|\bpurple\b|\bivory\b/i);
  });

  it("uses a single route-backed registry with no duplicate destinations per context", () => {
    for (const item of PROTECTED_NAVIGATION_REGISTRY) expect(routeExists(item.href)).toBe(true);
    for (const context of ["CUSTOMER", "STORE", "DRIVER", "PROMOTER", "DEVELOPER", "ADMIN", "SUPER_ADMIN"] as const) {
      const hrefs = PROTECTED_NAVIGATION_REGISTRY.filter((item) => item.contexts.includes(context)).map((item) => item.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
    }
    expect(PROTECTED_CONTEXTS_BY_ROLE).not.toHaveProperty("APPLICANT");
  });

  it("removes unauthorized navigation before the shell projection and groups admin workspaces", () => {
    const noPermissions = projectProtectedNavigation("ADMIN", new Set());
    expect(noPermissions.groups).toEqual([]);

    const onlyDashboard = projectProtectedNavigation("ADMIN", new Set(["admin.dashboard.read"]));
    expect(onlyDashboard.groups.flatMap((group) => group.items).map((item) => item.href)).toEqual(["/admin"]);

    const allPermissions = new Set(PROTECTED_NAVIGATION_REGISTRY.flatMap((item) => item.requiredPermissions ?? []));
    const admin = projectProtectedNavigation("ADMIN", allPermissions);
    expect(admin.groups.map((group) => group.label)).toEqual(expect.arrayContaining(["Command centre", "Operations", "People and network", "Finance", "Governance"]));
    expect(readSource("lib/protected-navigation/resolve-protected-navigation.ts")).toContain("getEffectivePermissionKeysForUser");
  });

  it("derives mobile priorities from the registry and gives complex roles a full navigation drawer", () => {
    const customer = projectProtectedNavigation("CUSTOMER", new Set());
    const driver = projectProtectedNavigation("DRIVER", new Set());
    expect(customer.mobileNavigation.length).toBeGreaterThanOrEqual(4);
    expect(driver.mobileNavigation.length).toBeGreaterThanOrEqual(4);
    const mobileSource = readSource("components/protected-v2/navigation/ProtectedMobileNavigation.tsx");
    expect(mobileSource).toContain('const bottomNavigationContexts: readonly ProtectedApplicationContext[] = ["CUSTOMER", "DRIVER"]');
    expect(mobileSource).toContain("<ProtectedDrawer");
  });

  it("provides focus-managed overlays with an explicit close control", () => {
    const drawer = readSource("components/protected-v2/overlays/ProtectedDrawer.tsx");
    const focus = readSource("components/protected-v2/overlays/useOverlayFocus.ts");
    expect(drawer).toContain('role="dialog"');
    expect(drawer).toContain("aria-modal=\"true\"");
    expect(drawer).toContain("Close ${title}");
    expect(focus).toContain('event.key === "Escape"');
    expect(focus).toContain("previousFocus?.focus()");
    expect(focus).not.toMatch(/tabIndex=\{?[1-9]/);
  });

  it("keeps four original, data-free foundation illustrations", () => {
    expect(Object.keys(PROTECTED_ILLUSTRATIONS)).toHaveLength(4);
    for (const file of collectSources("components/protected-v2/illustrations")) {
      const source = readSource(file);
      expect(source).not.toMatch(/linearGradient|radialGradient|<text\b|https?:\/\//);
    }
  });
});

function collectSources(directory: string): string[] {
  const visit = (relative: string): string[] => readdirSync(path.join(workspaceRoot, relative)).flatMap((entry) => {
    const entryPath = path.join(relative, entry);
    return statSync(path.join(workspaceRoot, entryPath)).isDirectory() ? visit(entryPath) : entryPath.endsWith(".ts") || entryPath.endsWith(".tsx") ? [entryPath] : [];
  });
  return visit(directory);
}
