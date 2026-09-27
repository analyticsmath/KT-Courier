import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import ts from "typescript";

export const publicColorRoots = ["app/(public)", "app/(auth)", "components/public-v2", "components/public-v3"];
export const publicSharedFiles = ["components/forms/ContactForm.module.css"];
export const canonicalTokenFile = "components/public-v3/foundation/tokens.css";
const compatibilityFile = "components/public-v2/foundation/public-tokens.css";
const warm = /#(?:f1ece2|fbf9f3|cdc4b5|eae5db|eeece6|e9e7e0|eceae4|e7e5df|f6f4ee)\b/gi;
const blue = /#(?:1776d2|144f8c|3975b5|2f6edb|103f71|347cfb)\b/gi;
const green = /#(?:1e6e38|16532a)\b/gi;
const staleNeutral = /#(?:fafbfc|f6f7f8|f1f3f5|e2e5e9|6d747c)\b/gi;
const deprecated = /var\(--kt-(?:freight-paper|paper|bone|concrete|mist)\b/g;
const literal = /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?)\([^)]*\)/gi;
const allowedComment = /kt-color-audit-allow:\s*(\S[^*\n]*)/;
const borderShorthand = /^border(?:-(?:top|right|bottom|left|block(?:-start|-end)?|inline(?:-start|-end)?))?$/i;
const colorToken = /^--kt-public-(?:border|line|text|surface|action|interactive|brand|focus|canvas)(?:-|$)|^--kt-(?:neutral|white|carbon|cobalt|signal-red|state|brand-blue|brand-red)(?:-|$)/;
const brightCobaltText = /^var\(\s*--(?:kt-public-interactive|kt-cobalt|kt-brand-blue)\s*\)(?:\s*!important)?$/i;
const cobaltTextContext = /\b(?:inverse|dark|large\s+text|icon|graphic)\b/i;

// Follow local aliases as well as named foundation colors. A complete border
// token (for example "1px solid var(...)") is deliberately not a color token.
function isColorOnly(value, aliases, visited = new Set()) {
  if (/^(?:#[\da-f]{3,8}|(?:rgba?|hsla?)\([^)]*\))$/i.test(value.trim())) return true;
  const alias = value.trim().match(/^var\(\s*(--[\w-]+)(?:\s*,[\s\S]+)?\s*\)$/);
  if (!alias || visited.has(alias[1])) return false;
  const definitions = aliases.get(alias[1]);
  if (!definitions) return colorToken.test(alias[1]);
  const next = new Set(visited).add(alias[1]);
  return definitions.some(definition => isColorOnly(definition, aliases, next));
}

/** Scan real CSS declarations / TS string literals, never anchor IDs or prose. */
export function auditPublicColorSource(file, source) {
  const findings = [], exceptions = [];
  const normalized = file.replaceAll("\\", "/");
  const authority = normalized === canonicalTokenFile;
  const compatibility = normalized === compatibilityFile;
  const inspect = (value, line, reason = null) => {
    const record = (kind, matches) => matches.forEach(match => findings.push({ file: normalized, line, kind, value: match }));
    record("prohibited-warm", [...value.matchAll(warm)].map(m => m[0]));
    record("legacy-blue", [...value.matchAll(blue)].map(m => m[0]));
    record("legacy-green", [...value.matchAll(green)].map(m => m[0]));
    if (!reason) record("stale-neutral", [...value.matchAll(staleNeutral)].map(m => m[0]));
    if (!authority && !compatibility) record("deprecated-token", [...value.matchAll(deprecated)].map(m => m[0]));
    record("generated-shade", /color-mix\(|\b(?:lighten|darken)\(/.test(value) ? [value] : []);
    record("malformed-token", /var\(--var\(|var\([^)]*\)\/[\d.]+/.test(value) ? [value] : []);
    record("palette-utility", [...value.matchAll(/\b(?:bg|text|border|ring|outline|fill|stroke)-(?:blue|red|green|gray|slate|neutral|zinc|stone|amber|yellow|emerald|orange|violet|purple|pink|cyan|teal|lime|indigo|rose)-(?:\d{2,3})\b/g)].map(m => m[0]));
    if (authority) return;
    const raw = [...value.matchAll(literal)].map(m => m[0]);
    if (raw.length && reason) exceptions.push({ file: normalized, line, reason: reason.trim(), values: raw });
    else record("raw-color", raw);
  };
  if (normalized.endsWith(".css")) {
    const css = postcss.parse(source, { from: normalized });
    const aliases = new Map();
    css.walkDecls(/^--/, d => {
      aliases.set(d.prop, [...(aliases.get(d.prop) ?? []), d.value]);
    });
    css.walkDecls(d => {
      const reason = d.prev()?.type === "comment" ? d.prev().text.match(allowedComment)?.[1] : null;
      inspect(d.value, d.source.start.line, reason);
      if (borderShorthand.test(d.prop) && isColorOnly(d.value, aliases)) {
        findings.push({ file: normalized, line: d.source.start.line, kind: "color-only-border", value: `${d.prop}: ${d.value}`, selector: d.parent.selector,
          suggestion: "Use 1px solid var(...) or border-color with width/style defined separately." });
      }
      if (d.prop.toLowerCase() === "color" && brightCobaltText.test(d.value)) {
        if (reason && cobaltTextContext.test(reason)) exceptions.push({ file: normalized, line: d.source.start.line, kind: "cobalt-text", reason: reason.trim(), values: [d.value] });
        else findings.push({ file: normalized, line: d.source.start.line, kind: "bright-cobalt-text", value: d.value, selector: d.parent.selector,
          suggestion: "Use --kt-public-interactive-text for normal light-surface text, or document the inverse/dark, large text or icon/graphic context." });
      }
      // These old greens cannot re-enter a general interaction role through aliases.
      if (/var\(--kt-state-success\)/.test(d.value) && /button|link|tab|hover|optional|bestprice/i.test(d.parent.selector ?? "")) {
        findings.push({ file: normalized, line: d.source.start.line, kind: "decorative-green", value: d.value });
      }
    });
  } else {
    const ast = ts.createSourceFile(normalized, source, ts.ScriptTarget.Latest, true, normalized.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = node => {
      if (ts.isStringLiteralLike(node)) {
        const value = node.text;
        // URL fragments, anchors and placeholders are not CSS colors.
        if (!/var\(--|#[\da-f]{6}\b|\b(?:rgba?|hsla?)\(|\b(?:bg|text|border|ring|outline|fill|stroke)-/i.test(value)) return;
        const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
        const preceding = source.split(/\r?\n/).slice(Math.max(0, line - 3), line).join("\n");
        inspect(value, line, preceding.match(allowedComment)?.[1]);
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  return { findings, exceptions };
}

export function auditPublicColorSystem(repo = process.cwd()) {
  const files = publicColorRoots.flatMap(root => fs.readdirSync(path.join(repo, root), { recursive: true })
    .filter(file => /\.(?:css|tsx?|jsx?)$/.test(file))
    .map(file => `${root}/${file}`.replaceAll("\\", "/")))
    .concat(publicSharedFiles);
  const findings = [], exceptions = [];
  for (const file of files) {
    // Logo artwork and asset registries are immutable content, outside CSS palette debt.
    if (/\/brand\/|\/media\/|generated-actor-media/.test(file)) continue;
    const result = auditPublicColorSource(file, fs.readFileSync(path.join(repo, file), "utf8"));
    findings.push(...result.findings);
    exceptions.push(...result.exceptions);
  }
  // Only the public rules in globals are audited. Protected products are intentionally excluded.
  postcss.parse(fs.readFileSync(path.join(repo, "app/globals.css"), "utf8")).walkRules(rule => {
    if (!/data-kt-signature|editorial-freight|^\.layout-public$/.test(rule.selector)) return;
    const result = auditPublicColorSource("app/globals.css", rule.toString());
    const offset = rule.source.start.line - 1;
    findings.push(...result.findings.map(f => ({ ...f, line: f.line + offset })));
    exceptions.push(...result.exceptions.map(f => ({ ...f, line: f.line + offset })));
  });
  return { scannedFiles: files.length + 1, findings, exceptions };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = auditPublicColorSystem();
  if (process.argv.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else {
    for (const finding of result.findings) console.error(`${finding.file}:${finding.line} ${finding.kind}: ${finding.value}${finding.suggestion ? ` — ${finding.suggestion}` : ""}`);
    console.log(`Public color audit: ${result.scannedFiles} files, ${result.findings.length} findings, ${result.exceptions.length} documented exceptions.`);
  }
  process.exitCode = result.findings.length ? 1 : 0;
}
