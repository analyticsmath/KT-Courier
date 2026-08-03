import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync("app/(admin)/admin/ledger/page.tsx", "utf8");
const tables = readFileSync("components/admin/LedgerTables.tsx", "utf8");
const filters = readFileSync("components/admin/LedgerFilters.tsx", "utf8");
const journal = readFileSync("app/(admin)/admin/ledger/journals/[id]/page.tsx", "utf8");

describe("read-only ledger admin UI contract", () => {
  it("uses exact headings, labelled filters, semantic tables, pagination, and empty states", () => {
    expect(dashboard).toContain('title="Ledger"');
    expect(dashboard).toContain("Ledger accounts");
    expect(dashboard).toContain("Ledger journals");
    expect(filters).toContain("Account purpose");
    expect(filters).toContain("Account status");
    expect(filters).toContain("Journal reference");
    expect(tables).toContain('aria-label="Ledger accounts"');
    expect(tables).toContain('aria-label="Ledger journals"');
    expect(tables).toContain('scope="col">Debit');
    expect(tables).toContain('scope="col">Credit');
    expect(tables).toContain("No ledger accounts");
    expect(tables).toContain("No ledger journals");
  });

  it("renders server balancing and safe metadata without reconstructing finance rules", () => {
    expect(journal).toContain("journal.balanced");
    expect(journal).toContain("Balanced journal");
    expect(journal).toContain("metadataRedacted");
    expect(journal).not.toMatch(/parseFloat|Number\(|Math\.round|\.toFixed\(/);
  });

  it("contains no credit, debit, transfer, reversal, or balance-edit controls", () => {
    const visibleControls = `${dashboard}\n${tables}\n${journal}`;
    expect(visibleControls).not.toMatch(/>\s*(Credit|Debit|Transfer|Reverse|Edit balance)\s*</i);
  });
});
