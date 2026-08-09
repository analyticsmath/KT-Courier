import { writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { isSchemaDiffVerbose, loadLocalEnv, run, safeError, safeLog, sanitize } from "./docker-common.mjs";

const prismaCli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
const env = loadLocalEnv();
const databaseUrl = env.DATABASE_URL;
export const DRIFT_SUMMARY_LIMIT = 8;

function normalizeColumns(columns) {
  if (!columns) return [];
  return columns
    .split(",")
    .map((column) => column.trim().replace(/^["`]|["`]$/g, ""))
    .filter(Boolean);
}

function columnsFromLine(line) {
  return normalizeColumns(line.match(/\bon\s+columns?\s*\(([^)]+)\)/i)?.[1]);
}

function actionFromLine(line, action, followingAction) {
  const match = line.match(
    new RegExp(`\\bon\\s+${action}\\s+(.+?)(?=\\s+on\\s+${followingAction}\\b|$)`, "i")
  );
  return match?.[1].trim().replace(/[.,;]+$/g, "") || null;
}

function foreignKeyMetadata(line) {
  const target =
    line.match(
      /\b(?:references|referencing)\s+(?:the\s+)?(?:table\s+)?(?:["`]([^"`]+)["`]|([A-Za-z_][\w$]*))\s*(?:on\s+columns?\s*)?\(([^)]+)\)/i
    ) ||
    line.match(
      /\bto\s+(?:the\s+)?(?:table\s+)?(?:["`]([^"`]+)["`]|([A-Za-z_][\w$]*))\s*(?:on\s+columns?\s*)?\(([^)]+)\)/i
    );

  const constraintMatch =
    line.match(/\b(?:constraint|named)\s+["`]([^"`]+)["`]/i) ||
    line.match(/\bforeign\s+key\s+["`]([^"`]+)["`]/i);

  const validatedMatch = line.match(/\bconvalidated\s*=\s*(true|false)\b/i) || line.match(/\b(not\s+valid|valid)\b/i);
  const validated = validatedMatch ? !/not\s+valid|false/i.test(validatedMatch[0]) : true;

  const deferrableMatch = line.match(/\bdeferrable\b/i);

  return {
    constraintName: constraintMatch?.[1] || null,
    targetTable: target?.[1] ?? target?.[2] ?? null,
    targetColumns: normalizeColumns(target?.[3]),
    onDelete: actionFromLine(line, "delete", "update"),
    onUpdate: actionFromLine(line, "update", "delete"),
    validated,
    deferrable: Boolean(deferrableMatch),
  };
}

function indexPredicate(line) {
  return line.match(/\b(?:where|predicate)\s+(.+)$/i)?.[1].trim().replace(/[.,;]+$/g, "") || null;
}

function entry({ table, type, columns = [], unique = null, source, ...metadata }) {
  return { table, type, columns, unique, source, ...metadata };
}

function formatDifference(difference) {
  const columns = difference.columns.join(", ");
  if (difference.type.startsWith("FOREIGN_KEY_")) {
    const constraintPart = difference.constraintName ? ` (${difference.constraintName})` : "";
    const targetPart = difference.targetTable
      ? ` -> ${difference.targetTable}${difference.targetColumns?.length ? `(${difference.targetColumns.join(", ")})` : ""}`
      : "";
    const actionList = [
      difference.onDelete ? `ON DELETE ${difference.onDelete}` : null,
      difference.onUpdate ? `ON UPDATE ${difference.onUpdate}` : null,
    ].filter(Boolean);
    const actionPart = actionList.length ? ` ${actionList.join(" ")}` : "";
    const flagList = [
      difference.validated === false ? "NOT VALID" : null,
      difference.deferrable ? "DEFERRABLE" : null,
    ].filter(Boolean);
    const flagPart = flagList.length ? ` [${flagList.join(", ")}]` : "";

    return `[${difference.type}] ${difference.table}${columns ? `.${columns}` : ""}${constraintPart}${targetPart}${actionPart}${flagPart}`;
  }
  if (difference.type.startsWith("COLUMN_")) {
    return `[${difference.type}] ${difference.table}${columns ? `.${columns}` : ""}`;
  }
  if (difference.type.endsWith("INDEX_MISSING") || difference.type.endsWith("INDEX_EXTRA")) {
    return `[${difference.type}] ${difference.table}(${columns})`;
  }
  if (difference.type.startsWith("UNIQUE_CONSTRAINT_")) {
    return `[${difference.type}] ${difference.table}(${columns})`;
  }
  if (difference.type === "UNCLASSIFIED_DRIFT") {
    return `[UNCLASSIFIED_DRIFT] ${difference.table}: ${difference.source}`;
  }
  return `[${difference.type}] ${difference.table}`;
}

function isChangedTableHeading(line) {
  return /^\[\*\]\s+Changed\s+(?:the\s+)?(?:["`][^"`]+["`]\s+)?(?:table|model)\b/i.test(line) ||
    /^\[\*\]\s+Changed\s+(?:the\s+)?["`][^"`]+["`]\s+(?:table|model)\b/i.test(line);
}

function isChangedOtherObjectHeading(line) {
  return /^\[\*\]\s+Changed\s+(?:the\s+)?(?:["`][^"`]+["`]\s+)?(?:enum|view|sequence|schema)\b/i.test(line) ||
    /^\[\*\]\s+Changed\s+(?:the\s+)?["`][^"`]+["`]\s+(?:enum|view|sequence|schema)\b/i.test(line);
}

export function isStructuralDriftLine(line) {
  const trimmed = sanitizeSchemaDiff(line).trim();
  return /^\[(?:\+|-|\*)\]\s+/.test(trimmed) && !isChangedTableHeading(trimmed) && !isChangedOtherObjectHeading(trimmed);
}

export function sanitizeSchemaDiff(value) {
  return sanitize(value)
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s/@]+@[^\s'"`]+/gi, "[redacted credential URL]")
    .replace(/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqps?):\/\/[^\s'"`]+/gi, "[redacted connection URL]")
    .replace(
      /\b([A-Z][A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PASSPHRASE|CREDENTIAL|PRIVATE_KEY|ACCESS_KEY)[A-Z0-9_]*)\s*(?:=|:\s*)\s*("[^"]*"|'[^']*'|[^\s]+)/g,
      "$1=[redacted]"
    )
    .replace(/\b(authorization\s*:\s*(?:bearer|basic)\s+)[^\s]+/gi, "$1[redacted]")
    .replace(/([?&](?:api[_-]?key|token|secret|password|credential)=)[^&#\s]+/gi, "$1[redacted]");
}

function tableHeading(line) {
  return (
    line.match(/^\[\*\]\s+Changed\s+(?:the\s+)?["`]([^"`]+)["`]\s+(?:table|model)\b/i)?.[1] ||
    line.match(/^\[\*\]\s+Changed\s+(?:the\s+)?(?:table|model)\s+["`]([^"`]+)["`]/i)?.[1] ||
    null
  );
}

function addedOrRemovedObject(line, objectType) {
  const objectPattern = objectType === "enum" ? "enum" : "(?:table|model)";
  const match =
    line.match(
      new RegExp(`^\\[([+-])\\]\\s+(?:Added|Removed)\\s+(?:the\\s+)?["\\x60]([^"\\x60]+)["\\x60]\\s+${objectPattern}\\b`, "i")
    ) ||
    line.match(
      new RegExp(`^\\[([+-])\\]\\s+(?:Added|Removed)\\s+(?:the\\s+)?${objectPattern}\\s+["\\x60]([^"\\x60]+)["\\x60]`, "i")
    );
  if (!match) return null;

  return { name: match[2], direction: match[1] === "+" ? "MISSING" : "EXTRA" };
}

export function parseDriftLine(line, currentTable) {
  const trimmed = sanitizeSchemaDiff(line).trim();
  const changedTable = tableHeading(trimmed);
  if (changedTable) {
    return { newTable: changedTable, formatted: null, structural: false };
  }

  if (isChangedOtherObjectHeading(trimmed)) {
    return { clearTable: true, formatted: null, structural: false };
  }

  const changedOrAddedTable = addedOrRemovedObject(trimmed, "(?:table|model)");
  if (changedOrAddedTable) {
    const difference = entry({
      table: changedOrAddedTable.name,
      type: `TABLE_${changedOrAddedTable.direction}`,
      source: trimmed,
    });
    return {
      newTable: changedOrAddedTable.name,
      difference,
      formatted: formatDifference(difference),
      structural: true,
    };
  }

  const changedOrAddedEnum = addedOrRemovedObject(trimmed, "enum");
  if (changedOrAddedEnum) {
    const difference = entry({
      table: changedOrAddedEnum.name,
      type: `ENUM_${changedOrAddedEnum.direction}`,
      source: trimmed,
    });
    return {
      clearTable: true,
      difference,
      formatted: formatDifference(difference),
      structural: true,
    };
  }

  const inlineTableMatch = trimmed.match(/\bon\s+table\s+["`]([^"`]+)["`]/i);
  const table = inlineTableMatch?.[1] || currentTable || "UnknownTable";
  const columns = columnsFromLine(trimmed);
  let match = trimmed.match(/^\[([+-])\]\s+Added\s+(unique\s+)?index\b/i) ||
    trimmed.match(/^\[([+-])\]\s+Removed\s+(unique\s+)?index\b/i);

  if (match) {
    const missing = match[1] === "+";
    const unique = Boolean(match[2]);
    const difference = entry({
      table,
      type: `${unique ? "UNIQUE_INDEX" : "INDEX"}_${missing ? "MISSING" : "EXTRA"}`,
      columns,
      unique,
      predicate: indexPredicate(trimmed),
      source: trimmed,
    });
    return { difference, formatted: formatDifference(difference), structural: true };
  }

  match = trimmed.match(/^\[([+-])\]\s+(?:Added|Removed)\s+foreign\s+key\b/i);
  if (match) {
    const metadata = foreignKeyMetadata(trimmed);
    const difference = entry({
      table,
      type: `FOREIGN_KEY_${match[1] === "+" ? "MISSING" : "EXTRA"}`,
      columns,
      source: trimmed,
      ...metadata,
    });
    return { difference, formatted: formatDifference(difference), structural: true };
  }

  match = trimmed.match(/^\[([+-])\]\s+(?:Added|Removed)\s+column\s+(?:["`])?([^"`\s(]+)(?:["`])?/i);
  if (match) {
    const difference = entry({
      table,
      type: `COLUMN_${match[1] === "+" ? "MISSING" : "EXTRA"}`,
      columns: [match[2]],
      source: trimmed,
    });
    return { difference, formatted: formatDifference(difference), structural: true };
  }

  match = trimmed.match(/^\[\*\]\s+Changed\s+column\s+(?:["`])?([^"`\s(]+)(?:["`])?/i);
  if (match) {
    const difference = entry({ table, type: "COLUMN_CHANGED", columns: [match[1]], source: trimmed });
    return { difference, formatted: formatDifference(difference), structural: true };
  }

  match = trimmed.match(/^\[([+-])\]\s+(?:Added|Removed)\s+unique\s+constraint\b/i);
  if (match) {
    const difference = entry({
      table,
      type: `UNIQUE_CONSTRAINT_${match[1] === "+" ? "MISSING" : "EXTRA"}`,
      columns,
      unique: true,
      source: trimmed,
    });
    return { difference, formatted: formatDifference(difference), structural: true };
  }

  if (isStructuralDriftLine(trimmed)) {
    const difference = entry({ table, type: "UNCLASSIFIED_DRIFT", source: trimmed });
    return { difference, formatted: formatDifference(difference), structural: true };
  }

  return { formatted: null, structural: false };
}

export function assertDriftParseComplete(report) {
  if (report.structuralLineCount !== report.differences.length) {
    throw new Error(
      `Prisma drift parsing was incomplete: found ${report.structuralLineCount} structural lines but parsed ${report.differences.length} entries.`
    );
  }
}

export function parsePrismaDrift(output) {
  const sanitizedOutput = sanitizeSchemaDiff(output);
  const differences = [];
  let currentTable = null;
  let structuralLineCount = 0;

  for (const rawLine of sanitizedOutput.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const result = parseDriftLine(trimmed, currentTable);
    if (result.newTable) currentTable = result.newTable;
    else if (result.clearTable) currentTable = null;
    if (result.structural) structuralLineCount += 1;
    if (result.difference) differences.push(result.difference);
  }

  const report = { sanitizedOutput, differences, structuralLineCount };
  assertDriftParseComplete(report);
  return report;
}

export function conciseDriftSummary(output) {
  const report = parsePrismaDrift(output);
  if (!report.differences.length) {
    return "Prisma reported structural differences without a textual summary.";
  }

  const visible = report.differences.slice(0, DRIFT_SUMMARY_LIMIT);
  return `${visible.map(formatDifference).join(" | ")} | Showing ${visible.length} of ${report.differences.length} differences. Set KT_SCHEMA_DIFF_VERBOSE=1 for the complete report.`;
}

export function formatVerboseDriftDifference(difference, position) {
  if (difference.type === "UNCLASSIFIED_DRIFT") {
    return `${position}. ${formatDifference(difference)} columns=(none)`;
  }

  const fields = [
    `${position}. [${difference.type}]`,
    `table=${difference.table}`,
    `columns=(${difference.columns.join(", ") || "none"})`,
  ];
  if (difference.unique !== null) fields.push(`unique=${difference.unique}`);
  if (difference.targetTable) fields.push(`targetTable=${difference.targetTable}`);
  if (difference.targetColumns?.length) fields.push(`targetColumns=(${difference.targetColumns.join(", ")})`);
  if (difference.onDelete) fields.push(`onDelete=${difference.onDelete}`);
  if (difference.onUpdate) fields.push(`onUpdate=${difference.onUpdate}`);
  if (difference.predicate) fields.push(`predicate=${difference.predicate}`);
  return fields.join(" ");
}

export function formatVerboseDriftReport(output) {
  const report = parsePrismaDrift(output);
  const summary = [
    `Total parsed differences: ${report.differences.length}`,
    ...report.differences.map((difference, index) => formatVerboseDriftDifference(difference, index + 1)),
  ];
  return { ...report, summary: summary.join("\n") };
}

function writeDriftArtifact(result) {
  const configuredPath = process.env.KT_SCHEMA_DRIFT_ARTIFACT?.trim();
  if (!configuredPath) return;

  const artifactPath = path.resolve(configuredPath);
  const migrationsPath = path.resolve(process.cwd(), "prisma", "migrations");
  const relativePath = path.relative(migrationsPath, artifactPath);
  const isInMigrationDirectory =
    relativePath === "" ||
    (relativePath !== ".." && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath));
  if (isInMigrationDirectory) {
    throw new Error("KT_SCHEMA_DRIFT_ARTIFACT must not point inside prisma/migrations.");
  }

  const artifact = [result.stdout, result.stderr].filter(Boolean).join("\n");
  writeFileSync(artifactPath, `${sanitizeSchemaDiff(artifact)}\n`, "utf8");
  safeError(`Complete sanitized Prisma drift output written to ${artifactPath}.`);
}

function safeSchemaError(value) {
  safeError(sanitizeSchemaDiff(value));
}

export function runVerification() {
  if (!databaseUrl) {
    safeError("DATABASE_URL is required for database-to-schema verification.");
    process.exit(1);
  }

  const result = run(
    process.execPath,
    [
      prismaCli,
      "migrate",
      "diff",
      "--from-url",
      databaseUrl,
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--exit-code",
    ],
    { env }
  );

  if (result.status === 0) {
    safeLog("Prisma diff executed successfully: database schema matches prisma/schema.prisma.");
    process.exit(0);
  }

  if (result.status === 2) {
    const prismaOutput = [result.stdout, result.stderr].filter(Boolean).join("\n");
    const report = formatVerboseDriftReport(prismaOutput);
    safeError(`Prisma executed successfully and found ${report.differences.length} structural differences.`);
    if (isSchemaDiffVerbose(process.env)) {
      safeError("Complete structured drift report:");
      safeSchemaError(report.summary);
      safeError("Complete sanitized Prisma output:");
      safeSchemaError(report.sanitizedOutput || "Prisma returned no textual diff output.");
    } else {
      safeError(`Drift summary: ${conciseDriftSummary(prismaOutput)}`);
    }
    try {
      writeDriftArtifact(result);
    } catch (error) {
      safeError(error instanceof Error ? error.message : "Unable to write the schema-drift artifact.");
    }
    process.exit(2);
  }

  safeError("Prisma diff did not complete successfully; this is a command failure, not a drift result.");
  if (result.stdout) safeSchemaError(result.stdout);
  if (result.stderr) safeSchemaError(result.stderr);
  process.exit(result.status ?? 1);
}

const isMainScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainScript) {
  runVerification();
}
