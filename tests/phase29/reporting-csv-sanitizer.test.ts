import { describe, it, expect } from "vitest";
import { sanitizeCsvCell, formatCsvReport, formatJsonReport } from "@/lib/reporting/csv-sanitizer";

describe("Phase 29 CSV Sanitizer & Formula Injection Protection", () => {
  it("must prepend a single quote to cells starting with formula characters", () => {
    expect(sanitizeCsvCell("=1+2")).toBe("'=1+2");
    expect(sanitizeCsvCell("+123")).toBe("'+123");
    expect(sanitizeCsvCell("-50")).toBe("'-50");
    expect(sanitizeCsvCell("@cmd")).toBe("'@cmd");
  });

  it("must properly escape quotes and enclose cells containing commas", () => {
    expect(sanitizeCsvCell("Hello, World")).toBe('"Hello, World"');
    expect(sanitizeCsvCell('Text with "quotes"')).toBe('"Text with ""quotes"""');
  });

  it("must format CSV rows correctly", () => {
    const headers = ["ID", "Formula", "Notes"];
    const rows = [
      { ID: "1", Formula: "=SUM(A1:A10)", Notes: "Safe, clean cell" },
      { ID: "2", Formula: "Normal Value", Notes: "Contains, comma" },
    ];
    const csv = formatCsvReport(headers, rows);
    expect(csv).toContain("ID,Formula,Notes");
    expect(csv).toContain('1,\'=SUM(A1:A10),"Safe, clean cell"');
    expect(csv).toContain('2,Normal Value,"Contains, comma"');
  });

  it("must format JSON report correctly", () => {
    const rows = [{ key: "val" }];
    const json = formatJsonReport(rows);
    expect(JSON.parse(json)).toEqual(rows);
  });
});
