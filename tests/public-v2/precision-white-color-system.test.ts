import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";
import { auditPublicColorSource, auditPublicColorSystem } from "../../scripts/audit-public-color-system.mjs";

const source = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const canonical = source("components/public-v3/foundation/tokens.css");
const declarations = new Map<string, string>();
postcss.parse(canonical).nodes.find(node => node.type === "rule")!.walkDecls(d => { declarations.set(d.prop, d.value); });
function resolve(name: string, visited = new Set<string>()): string {
  if (visited.has(name)) throw new Error(`Token cycle: ${name}`);
  visited.add(name);
  const value = declarations.get(name);
  if (!value) throw new Error(`Missing token: ${name}`);
  const alias = value.match(/^var\((--[\w-]+)\)$/);
  return alias ? resolve(alias[1]!, visited) : value.toUpperCase();
}
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    .reduce((total, c, i) => total + c * [0.2126, 0.7152, 0.0722][i]!, 0);
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

describe("KT Precision White public contract", () => {
  it.each([
    ["white-000", "#FFFFFF"], ["white-050", "#FAFBFC"], ["white-100", "#F6F7F8"], ["white-200", "#F1F3F5"],
    ["cobalt", "#3479F8"], ["signal-red", "#E10F1B"], ["public-canvas", "#FAFBFC"], ["public-surface-primary", "#FFFFFF"],
    ["public-action-primary", "#0B0D0F"], ["public-action-primary-hover", "#171A1E"], ["public-action-primary-pressed", "#24282D"],
  ])("resolves %s to %s", (name, value) => expect(resolve(`--kt-${name}`)).toBe(value));

  it("keeps brand and status colors independent", () => {
    expect(resolve("--kt-state-error")).toBe("#C9362B");
    expect(resolve("--kt-state-error")).not.toBe(resolve("--kt-signal-red"));
    expect(resolve("--kt-state-success")).toBe("#167447");
    expect(resolve("--kt-state-success")).not.toBe(resolve("--kt-cobalt"));
    expect(resolve("--kt-state-warning")).toBe("#8B5E00");
    expect(resolve("--kt-state-info")).toBe(resolve("--kt-cobalt-deep"));
    expect(resolve("--kt-state-surface")).toBe("#FFFFFF");
    expect(resolve("--kt-state-surface-muted")).toBe("#F6F7F8");
  });

  it("scopes raw colors to public roots and resolves every alias without cycles", () => {
    const boundary = postcss.parse(canonical).nodes.find(node => node.type === "rule")!;
    expect(boundary.selector).toContain('[data-kt-version="v3"]');
    expect(boundary.selector).toContain('[data-kt-signature="v2"]');
    expect(boundary.selector).not.toContain(":root");
    for (const [name, value] of declarations) if (/^(?:#|var\()/.test(value)) expect(resolve(name)).toMatch(/^#[A-F\d]{6}$/);
  });

  it("loads the same authority for v2, without another raw palette", () => {
    const v2 = source("components/public-v2/foundation/public-tokens.css");
    expect(v2).toContain('@import "../../public-v3/foundation/tokens.css"');
    expect(v2).not.toMatch(/#[\da-f]{3,8}\b/i);
    expect(v2).toContain("--canvas-light: var(--kt-public-canvas)");
    expect(resolve("--kt-freight-paper")).toBe("#FAFBFC");
    expect(resolve("--kt-bone")).toBe("#FFFFFF");
    expect(resolve("--kt-concrete")).toBe("#C8CDD2");
  });

  it("uses semantic root colors and keeps the existing public attributes", () => {
    const root = source("components/public-v3/foundation/PublicVisualRoot.tsx");
    expect(root).toContain("bg-[var(--kt-public-canvas)]");
    expect(root).toContain("text-[var(--kt-public-text-primary)]");
    expect(root).toContain('data-kt-version="v3"');
    expect(root).toContain('data-kt-theme="light"');
    expect(root).not.toContain("--kt-freight-paper");
  });

  it("removes warm core values, old blue shades and decorative Commerce green", () => {
    expect(auditPublicColorSource("components/public-v3/foundation/tokens.css", canonical).findings).toEqual([]);
    const commerce = source("components/public-v2/commerce/commerce.module.css");
    expect(commerce).not.toMatch(/#(?:1e6e38|16532a|1776d2|144f8c|3975b5|2f6edb)\b/i);
    const css = postcss.parse(commerce);
    const get = (selector: string, property: string) => {
      let value: string | undefined;
      css.walkRules(selector, rule => rule.walkDecls(property, d => { value = d.value; }));
      return value;
    };
    expect(get(".pdpFeedbackBtnPrimary", "background")).toBe("var(--kt-public-action-primary)");
    expect(get(".pdpModifierBadgeOptional", "color")).toBe("var(--kt-public-text-secondary)");
    expect(get(".pdpStockDotGreen", "background")).toBe("var(--kt-state-success)");
    expect(get(".variantOptionButtonActive", "border-color")).toBe("var(--kt-public-interactive)");
    expect(get(".variantOptionButtonActive", "background-color")).toBe("var(--kt-public-surface-primary)");
  });

  it.each([
    ["text-primary", "canvas", 4.5], ["text-secondary", "canvas", 4.5], ["text-muted", "canvas", 4.5],
    ["interactive-text", "canvas", 4.5], ["text-primary", "surface-primary", 4.5], ["text-muted", "surface-primary", 4.5],
    ["text-inverse", "surface-inverse", 4.5], ["text-inverse-muted", "surface-inverse", 4.5],
    ["text-inverse-muted", "surface-inverse-raised", 4.5], ["text-muted-on-surface", "surface-secondary", 4.5],
    ["text-muted-on-surface", "surface-tertiary", 4.5], ["border-control", "surface-primary", 3],
    ["border-control", "surface-secondary", 3], ["focus", "canvas", 3], ["focus", "surface-primary", 3],
    ["focus", "surface-inverse", 3], ["interactive", "canvas", 3],
    ["text-inverse", "interactive-hover", 4.5],
  ])("meets contrast: %s on %s >= %s", (foreground, background, minimum) => {
    expect(contrast(resolve(`--kt-public-${foreground}`), resolve(`--kt-public-${background}`))).toBeGreaterThanOrEqual(minimum);
  });

  it.each(["success", "warning", "error", "info"])("keeps %s text accessible on neutral status surfaces", state => {
    for (const surface of ["surface", "surface-muted"]) expect(contrast(resolve(`--kt-state-${state}`), resolve(`--kt-state-${surface}`))).toBeGreaterThanOrEqual(4.5);
  });

  it("restricts bright Cobalt and the light-muted neutral to appropriate roles", () => {
    expect(contrast(resolve("--kt-public-interactive"), resolve("--kt-public-canvas"))).toBeLessThan(4.5);
    expect(contrast(resolve("--kt-public-text-muted"), resolve("--kt-public-surface-secondary"))).toBeLessThan(4.5);
    expect(canonical).toContain("--kt-public-interactive-text: var(--kt-public-interactive)");
    expect(source("components/public-v2/commerce/commerce.module.css")).toContain(".searchCommandInput::placeholder { color: var(--kt-public-text-muted-on-surface)");
  });

  it("identifies forbidden values and does not excuse legacy colors with an alpha comment", () => {
    const result = auditPublicColorSource("components/public-v2/test.css", ".page { background: #F1ECE2; color: #1776D2; --accent: #1E6E38; }");
    expect(result.findings.map(f => f.kind)).toEqual(expect.arrayContaining(["prohibited-warm", "legacy-blue", "legacy-green", "raw-color"]));
    expect(auditPublicColorSource("components/public-v2/test.css", ".page { /* kt-color-audit-allow: shadow */ color: #1776D2; }").findings.map(f => f.kind)).toContain("legacy-blue");
    expect(auditPublicColorSource("components/public-v2/test.css", ".page { color: var(--kt-bone); }").findings[0]?.kind).toBe("deprecated-token");
    expect(auditPublicColorSource("components/public-v2/test.css", ".link { color: var(--kt-state-success); }").findings[0]?.kind).toBe("decorative-green");
  });

  it("allows only documented technical alpha and ignores anchors", () => {
    const result = auditPublicColorSource("components/public-v2/test.css", ".panel { /* kt-color-audit-allow: elevation alpha */ box-shadow: 0 2px 4px rgba(0,0,0,.1); }");
    expect(result.findings).toEqual([]);
    expect(result.exceptions).toHaveLength(1);
    expect(auditPublicColorSource("components/public-v2/test.tsx", 'const classes = "bg-blue-600 text-gray-500";').findings.map(f => f.kind)).toEqual(["palette-utility", "palette-utility"]);
    expect(auditPublicColorSource("components/public-v2/test.css", ".panel { color: var(--var(--kt-public-text-inverse)); }").findings[0]?.kind).toBe("malformed-token");
    expect(auditPublicColorSource("components/public-v2/test.tsx", 'const anchor = "#contact-form";').findings).toEqual([]);
  });

  it("has no unexplained public color debt", () => expect(auditPublicColorSystem().findings).toEqual([]));
});
