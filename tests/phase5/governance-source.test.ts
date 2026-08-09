import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("Phase 5 source governance", () => {
  it("keeps operational governance models in one additive Phase 5 migration", () => {
    const schema = fs.readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8");
    const migration = fs.readFileSync(path.join(root, "prisma", "migrations", "20260805010000_phase5_operational_governance", "migration.sql"), "utf8");
    for (const model of ["OperationalIncident", "OperationalProcessorRun", "PrivacyRequest", "RetentionHold", "LegalDocumentVersion", "LegalDocumentAcceptance"]) {
      expect(schema).toContain(`model ${model}`);
      expect(migration).toContain(`\"${model}\"`);
    }
  });

  it("keeps the deferred consolidated-validation gates explicit", () => {
    const plan = fs.readFileSync(path.join(root, "docs", "final-consolidated-production-validation-plan.md"), "utf8");
    for (const gate of ["prisma migrate deploy", "Production build", "Critical browser journeys", "Backup and restore evidence", "Final risk and deployment decision"]) {
      expect(plan).toContain(gate);
    }
  });
});
