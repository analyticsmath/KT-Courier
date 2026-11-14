import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PROCESSOR_REGISTRY, type ProcessorName } from "@/lib/processors/processor-registry";
import { PROCESSOR_HANDLERS } from "@/lib/processors/processor-service";
import {
  CONFLICT_PRECEDENCE_AUTHORITY,
  DIRECTIVE_REQUIREMENT_COVERAGE_REGISTER,
  PROCESSOR_EXECUTION_MATRIX,
} from "@/lib/governance/directive-code-coverage-register";

function resolveRepoFile(ref: string): string {
  const filePart = ref.split("#")[0]?.trim() ?? "";
  return path.resolve(process.cwd(), filePart);
}

describe("P2-02 & §7.6 Directive Code-Coverage Register and Processor Execution Matrix", () => {
  it("records the canonical 4-tier conflict precedence authority with Website Developer Brief above Updated Details", () => {
    expect(CONFLICT_PRECEDENCE_AUTHORITY).toHaveLength(4);
    expect(CONFLICT_PRECEDENCE_AUTHORITY[0]?.rank).toBe(1);
    expect(CONFLICT_PRECEDENCE_AUTHORITY[1]?.authority).toContain("Website Developer Brief");
    expect(CONFLICT_PRECEDENCE_AUTHORITY[2]?.authority).toContain("Delivery and Access");
    expect(CONFLICT_PRECEDENCE_AUTHORITY[3]?.authority).toContain("Updated Details");
  });

  it("maps every registered processor to a concrete handler, bounded scan, lease, activation gate, and existing positive/negative tests", () => {
    const registryNames = Object.keys(PROCESSOR_REGISTRY).sort() as ProcessorName[];
    const matrixNames = Object.keys(PROCESSOR_EXECUTION_MATRIX).sort() as ProcessorName[];
    expect(matrixNames).toEqual(registryNames);

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
      expect(existsSync(resolveRepoFile(entry.positiveTest))).toBe(true);
      expect(existsSync(resolveRepoFile(entry.negativeTest))).toBe(true);
    }
  });

  it("covers all 60 acceptance matrix scenarios (PAR-01..PAR-60) and core directive requirements with existing symbols and tests", () => {
    const ids = new Set(DIRECTIVE_REQUIREMENT_COVERAGE_REGISTER.map((item) => item.id));
    expect(ids.size).toBe(DIRECTIVE_REQUIREMENT_COVERAGE_REGISTER.length);

    for (let i = 1; i <= 60; i += 1) {
      const parId = `PAR-${String(i).padStart(2, "0")}`;
      expect(ids.has(parId)).toBe(true);
    }

    for (const item of DIRECTIVE_REQUIREMENT_COVERAGE_REGISTER) {
      expect(["IMPLEMENTED", "CODE_COMPLETE_ACTIVATION_GATED"]).toContain(item.status);
      if (item.status === "CODE_COMPLETE_ACTIVATION_GATED") {
        expect(item.activationGate && item.activationGate.length > 5).toBe(true);
      }
      const symbolPath = resolveRepoFile(item.canonicalSymbol);
      const posPath = resolveRepoFile(item.positiveTest);
      const negPath = resolveRepoFile(item.negativeTest);
      expect(existsSync(symbolPath), `Missing symbol file for ${item.id}: ${item.canonicalSymbol}`).toBe(true);
      expect(existsSync(posPath), `Missing positive test for ${item.id}: ${item.positiveTest}`).toBe(true);
      expect(existsSync(negPath), `Missing negative test for ${item.id}: ${item.negativeTest}`).toBe(true);
    }
  });
});
