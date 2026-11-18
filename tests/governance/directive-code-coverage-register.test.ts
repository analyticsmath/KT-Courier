import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PROCESSOR_REGISTRY, type ProcessorName } from "@/lib/processors/processor-registry";
import { PROCESSOR_HANDLERS } from "@/lib/processors/processor-service";
import {
  DELEGATED_COMPOSITE_PROCESSORS,
  productionProcessors,
} from "@/lib/processors/production-loop";
import {
  CONFLICT_PRECEDENCE_AUTHORITY,
  DIRECTIVE_REQUIREMENT_COVERAGE_REGISTER,
  PROCESSOR_EXECUTION_MATRIX,
} from "@/lib/governance/directive-code-coverage-register";

function resolveRepoFile(ref: string): string {
  const filePart = ref.split("#")[0]?.trim() ?? "";
  return path.resolve(process.cwd(), filePart);
}

const fileTextCache = new Map<string, string>();
function readCached(filePath: string): string {
  const cached = fileTextCache.get(filePath);
  if (cached !== undefined) return cached;
  const text = readFileSync(filePath, "utf8");
  fileTextCache.set(filePath, text);
  return text;
}

function getPrismaModels(): Set<string> {
  const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
  const schemaText = readCached(schemaPath);
  const models = new Set<string>();
  const pattern = /^model\s+([A-Za-z0-9_]+)\s*\{/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(schemaText)) !== null) {
    if (match[1]) models.add(match[1]);
  }
  return models;
}

function readTestSuiteContent(testFilePath: string): string {
  const fullPath = resolveRepoFile(testFilePath);
  const visited = new Set<string>();
  const chunks: string[] = [];

  function visit(currentPath: string, depth: number): void {
    if (visited.has(currentPath) || depth > 2 || !existsSync(currentPath)) return;
    visited.add(currentPath);
    const content = readCached(currentPath);
    chunks.push(content);

    const importPattern = /from\s+["'](\.\.?\/[^"']+)["']/g;
    let match: RegExpExecArray | null;
    while ((match = importPattern.exec(content)) !== null) {
      const rel = match[1];
      if (!rel) continue;
      const base = path.resolve(path.dirname(currentPath), rel);
      for (const candidate of [base, `${base}.ts`, `${base}.tsx`]) {
        if (existsSync(candidate) && candidate.includes(`${path.sep}tests${path.sep}`)) {
          visit(candidate, depth + 1);
          break;
        }
      }
    }
  }

  visit(fullPath, 0);
  return chunks.join("\n");
}

function assertNonTrivialTestFile(testFilePath: string, requirementId: string): void {
  const fullPath = resolveRepoFile(testFilePath);
  expect(existsSync(fullPath), `Missing test file for ${requirementId}: ${testFilePath}`).toBe(true);
  const content = readTestSuiteContent(testFilePath);

  const hasTestCase = /\b(?:it|test)(?:\.each)?\s*\(/.test(content);
  expect(hasTestCase, `No executable it/test block found in ${testFilePath} (${requirementId})`).toBe(true);

  const hasAssertion = /\bexpect\s*\(/.test(content);
  expect(hasAssertion, `No assertions found in ${testFilePath} (${requirementId})`).toBe(true);

  const hasSkippedOrTodo = /\b(?:it|test)\.(?:skip|todo|only)\s*\(\s*["'`]/.test(content);
  expect(hasSkippedOrTodo, `Skipped/todo/only test marker forbidden in ${testFilePath} (${requirementId})`).toBe(false);

  const nonTrivialExpectCount = (content.match(/\bexpect\s*\(/g) ?? []).length;
  const trivialTrueMatches = (content.match(/expect\s*\(\s*true\s*\)\s*\.toBe\s*\(\s*true\s*\)/g) ?? []).length;
  expect(
    nonTrivialExpectCount > trivialTrueMatches,
    `Only trivial expect(true).toBe(true) placeholders found in ${testFilePath} (${requirementId})`,
  ).toBe(true);
}

describe("F07 / P2-02 & §7.6 Directive Proof Index and Processor Execution Matrix", () => {
  it("records the canonical 4-tier conflict precedence authority with Website Developer Brief above Updated Details", () => {
    expect(CONFLICT_PRECEDENCE_AUTHORITY).toHaveLength(4);
    expect(CONFLICT_PRECEDENCE_AUTHORITY[0]?.rank).toBe(1);
    expect(CONFLICT_PRECEDENCE_AUTHORITY[1]?.authority).toContain("Website Developer Brief");
    expect(CONFLICT_PRECEDENCE_AUTHORITY[2]?.authority).toContain("Delivery and Access");
    expect(CONFLICT_PRECEDENCE_AUTHORITY[3]?.authority).toContain("Updated Details");
  });

  it("maps every one of the 30 registered processors accurately across productionProcessors (27) and delegated composites (3)", () => {
    const registryNames = Object.keys(PROCESSOR_REGISTRY).sort() as ProcessorName[];
    const matrixNames = Object.keys(PROCESSOR_EXECUTION_MATRIX).sort() as ProcessorName[];
    expect(registryNames).toHaveLength(30);
    expect(matrixNames).toEqual(registryNames);

    const scheduledSet = new Set<string>(productionProcessors);
    const delegatedSet = new Set<string>(Object.keys(DELEGATED_COMPOSITE_PROCESSORS));
    expect(scheduledSet.size).toBe(27);
    expect(delegatedSet.size).toBe(3);

    for (const name of registryNames) {
      const entry = PROCESSOR_EXECUTION_MATRIX[name];
      expect(entry.name).toBe(name);
      expect(["IMPLEMENTED", "CODE_COMPLETE_ACTIVATION_GATED"]).toContain(entry.engineeringStatus);
      expect(PROCESSOR_HANDLERS[name]).toBeTypeOf("function");
      expect(entry.boundedScan.defaultBatchSize).toBeGreaterThan(0);
      expect(entry.boundedScan.maxBatchSize).toBeGreaterThanOrEqual(entry.boundedScan.defaultBatchSize);
      expect(entry.boundedScan.enforcement.length).toBeGreaterThan(5);
      expect(entry.productionActivationGate.length).toBeGreaterThan(5);
      expect(existsSync(resolveRepoFile(entry.handlerSymbol))).toBe(true);

      if (scheduledSet.has(name)) {
        expect(["PRODUCTION_LOOP_AUTOMATIC", "PRODUCTION_LOOP_ACTIVATION_GATED"]).toContain(
          entry.schedulerRegistration,
        );
        expect(entry.cadenceMs).toBeGreaterThan(0);
      } else {
        expect(delegatedSet.has(name)).toBe(true);
        expect(entry.schedulerRegistration).toBe("TARGETED_OR_MANUAL_EXECUTION");
      }

      assertNonTrivialTestFile(entry.positiveTest, name);
      assertNonTrivialTestFile(entry.negativeTest, name);
    }
  });

  it("indexes all 38 SYS, 60 PAR, and 105 CR items with existing symbols, App Router paths, Prisma models, and non-trivial tests", () => {
    const ids = new Set(DIRECTIVE_REQUIREMENT_COVERAGE_REGISTER.map((item) => item.id));
    expect(ids.size).toBe(DIRECTIVE_REQUIREMENT_COVERAGE_REGISTER.length);

    for (let i = 1; i <= 38; i += 1) {
      const sysId = `SYS-${String(i).padStart(2, "0")}`;
      expect(ids.has(sysId), `Missing ${sysId}`).toBe(true);
    }
    for (let i = 1; i <= 60; i += 1) {
      const parId = `PAR-${String(i).padStart(2, "0")}`;
      expect(ids.has(parId), `Missing ${parId}`).toBe(true);
    }
    for (let i = 61; i <= 165; i += 1) {
      const crId = `CR-${String(i).padStart(3, "0")}`;
      expect(ids.has(crId), `Missing ${crId}`).toBe(true);
    }

    const prismaModels = getPrismaModels();
    const validatedTestFiles = new Set<string>();

    for (const item of DIRECTIVE_REQUIREMENT_COVERAGE_REGISTER) {
      expect(["IMPLEMENTED", "CODE_COMPLETE_ACTIVATION_GATED"]).toContain(item.status);
      if (item.status === "CODE_COMPLETE_ACTIVATION_GATED") {
        expect(item.activationGate && item.activationGate.length > 5).toBe(true);
      }

      const symbolPath = resolveRepoFile(item.canonicalSymbol);
      expect(existsSync(symbolPath), `Missing symbol file for ${item.id}: ${item.canonicalSymbol}`).toBe(true);

      const routePath = resolveRepoFile(item.uiOrApiRoute);
      expect(existsSync(routePath), `Missing UI/API route file for ${item.id}: ${item.uiOrApiRoute}`).toBe(true);

      const modelNames = item.dataModel
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
      expect(modelNames.length, `Missing dataModel for ${item.id}`).toBeGreaterThan(0);
      for (const modelName of modelNames) {
        expect(prismaModels.has(modelName), `Unknown Prisma model '${modelName}' in ${item.id}`).toBe(true);
      }

      if (!validatedTestFiles.has(item.positiveTest)) {
        assertNonTrivialTestFile(item.positiveTest, item.id);
        validatedTestFiles.add(item.positiveTest);
      }
      if (!validatedTestFiles.has(item.negativeTest)) {
        assertNonTrivialTestFile(item.negativeTest, item.id);
        validatedTestFiles.add(item.negativeTest);
      }
    }
  });
});
