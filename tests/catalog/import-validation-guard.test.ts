import { describe, expect, it } from "vitest";
import {
  assertCatalogImportCanApply,
  assertCatalogImportCanValidate,
} from "@/lib/catalog/catalog-import-policy";

describe("catalog import validation integrity", () => {
  it("does not complete a dry run when no imported rows exist", () => {
    expect(() => assertCatalogImportCanValidate({ status: "UPLOADED", rowStatuses: [] }))
      .toThrowError(/row|CSV|empty/i);
  });

  it("refuses to validate unparsed rows or already applied imports", () => {
    expect(() => assertCatalogImportCanValidate({ status: "UPLOADED", rowStatuses: ["PENDING"] }))
      .toThrowError(/parsed|checked|pending/i);
    expect(() => assertCatalogImportCanValidate({ status: "COMPLETED", rowStatuses: ["VALID"] }))
      .toThrowError(/uploaded|validated/i);
  });

  it("accepts nonempty parsed rows, including rows with validation errors for preview", () => {
    expect(() => assertCatalogImportCanValidate({ status: "UPLOADED", rowStatuses: ["VALID", "INVALID"] }))
      .not.toThrow();
  });

  it("prevents apply for empty or inconsistent row totals", () => {
    expect(() => assertCatalogImportCanApply({ status: "VALIDATED", dryRunCompleted: true, totalRows: 0, validRows: 0, invalidRows: 0 }))
      .toThrowError();
    expect(() => assertCatalogImportCanApply({ status: "VALIDATED", dryRunCompleted: true, totalRows: 2, validRows: 1, invalidRows: 0 }))
      .toThrowError();
  });

  it("allows apply only after an actual clean, nonempty dry run",¶»§q«^