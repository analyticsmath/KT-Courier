import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { resolveAdvertisingProductionComposition } from "@/lib/advertising/composition-root";
import * as prodLock from "@/lib/advertising/production-lock";

describe("Phase 24: Advertising Financial Composition & Source Audits", () => {
  const libDir = path.resolve(__dirname, "../../lib/advertising");
  const scriptsDir = path.resolve(__dirname, "../../scripts");

  // Helper to recursively find all files in a directory
  function getFilesRecursive(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.resolve(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getFilesRecursive(filePath));
      } else {
        results.push(filePath);
      }
    }
    return results;
  }

  it("Audit 1: The production root resolves real Phase 9 ledger and wallet authorities", () => {
    const comp = resolveAdvertisingProductionComposition();
    expect(comp.ledger).toBeDefined();
    expect(comp.ledger.ensureLedgerAccount).toBeDefined();
    expect(comp.ledger.ensureWalletForOwner).toBeDefined();
    expect(comp.ledger.getWalletAccount).toBeDefined();
    expect(comp.ledger.postLedgerJournalWithinTransaction).toBeDefined();
    expect(comp.wallet).toBeDefined();
    expect(comp.wallet.ensureWalletForOwner).toBeDefined();
    expect(comp.locking).toBeDefined();
    expect(comp.locking.lockAccounts).toBeDefined();
    expect(comp.journal).toBeDefined();
    expect(comp.journal.postLedgerJournalWithinTransaction).toBeDefined();
  });

  it("Audit 2: No production advertising file imports or depends on financial mocks", () => {
    const prohibited = [
      "mockLedger",
      "fakeLedger",
      "inMemoryLedger",
      "stubLedger",
      "mockWallet",
      "fakeWallet",
      "placeholderLedger",
      "testLedgerAdapter",
      "noopTransaction",
      "mockAccountLocker"
    ];

    const prodFiles = getFilesRecursive(libDir);
    for (const file of prodFiles) {
      if (file.endsWith(".test.ts") || file.endsWith(".spec.ts")) continue;
      const content = fs.readFileSync(file, "utf-8");
      for (const mockName of prohibited) {
        expect(content).not.toContain(mockName);
      }
    }
  });

  it("Audit 3: No in-memory ledger implementation exists in production composition root", () => {
    const content = fs.readFileSync(path.join(libDir, "composition-root.ts"), "utf-8");
    expect(content).not.toContain("inMemoryLedger");
    expect(content).not.toContain("fakeLedger");
  });

  it("Audit 4: No synthetic journal IDs are returned in composition root", () => {
    const content = fs.readFileSync(path.join(libDir, "composition-root.ts"), "utf-8");
    expect(content).not.toContain("return { id: \"mock-journal\" }");
    expect(content).not.toContain("journal-1");
  });

  it("Audit 5: No direct wallet balance or advertising revenue balance updates exist", () => {
    // Mutation of balances must go through canonical journal entries only
    const prodFiles = getFilesRecursive(libDir);
    for (const file of prodFiles) {
      if (file.endsWith(".test.ts") || file.endsWith(".spec.ts") || file.endsWith("repositories.ts")) continue;
      const content = fs.readFileSync(file, "utf-8");
      // Direct updates like balance = x or update({ data: { currentBalance: ... } }) are prohibited in production advertising services
      expect(content).not.toMatch(/currentBalance\s*:\s*{\s*(?:set|increment|decrement)/);
    }
  });

  it("Audit 6: Funding, charge, reversal and return call canonical journal services", () => {
    const fundingContent = fs.readFileSync(path.join(libDir, "funding.service.ts"), "utf-8");
    const billingContent = fs.readFileSync(path.join(libDir, "billing.service.ts"), "utf-8");

    expect(fundingContent).toContain("postLedgerJournalWithinTransaction");
    expect(billingContent).toContain("postLedgerJournalWithinTransaction");
  });

  it("Audit 7: Concrete Phase 9 dependencies resolve before the production lock check", () => {
    const content = fs.readFileSync(path.join(libDir, "composition-root.ts"), "utf-8");
    const reposIndex = content.indexOf("prismaRepositories");
    const ledgerIndex = content.indexOf("ledgerRepository");
    const walletIndex = content.indexOf("walletPayableAdapter");
    const lockIndex = content.lastIndexOf("assertAdvertisingProductionReady");

    expect(reposIndex).toBeLessThan(lockIndex);
    expect(ledgerIndex).toBeLessThan(lockIndex);
    expect(walletIndex).toBeLessThan(lockIndex);
  });

  it("Audit 8: The production root returns CONSOLIDATED_VALIDATION_NOT_APPROVED when locked", () => {
    const comp = resolveAdvertisingProductionComposition();
    expect(comp.status).toBe("LOCKED");
    expect(comp.code).toBe("CONSOLIDATED_VALIDATION_NOT_APPROVED");
  });

  it("Audit 9: The production lock applies in all environments", () => {
    expect(prodLock.ADVERTISING_PRODUCTION_VALIDATION_APPROVED).toBe(false);
    expect(prodLock.advertisingProductionReady()).toBe(false);
    expect(() => prodLock.assertAdvertisingProductionReady("CAMPAIGN_FUNDING")).toThrow(
      prodLock.AdvertisingProductionLockedError
    );
  });

  it("Audit 10: Complete processor inventory exists in scripts", () => {
    const expectedScripts = [
      "phase24-advertising-preflight.mjs",
      "activate-approved-advertising.mjs",
      "end-expired-advertising.mjs",
      "pause-exhausted-advertising.mjs",
      "process-valid-click-charges.mjs",
      "process-invalid-click-reversals.mjs",
      "return-unused-advertising-funding.mjs",
      "process-advertising-aggregation.mjs",
      "scan-advertising-reconciliation.mjs",
      "verify-advertising-invariants.mjs",
      "advertising-integration-scaffold.mjs"
    ];

    for (const scriptName of expectedScripts) {
      const scriptPath = path.join(scriptsDir, scriptName);
      expect(fs.existsSync(scriptPath)).toBe(true);
    }
  });

  it("Audit 11: Processors invoke production-root and handle locking properly", () => {
    const activeScripts = [
      "activate-approved-advertising.mjs",
      "end-expired-advertising.mjs",
      "pause-exhausted-advertising.mjs",
      "process-valid-click-charges.mjs",
      "process-invalid-click-reversals.mjs",
      "return-unused-advertising-funding.mjs",
      "process-advertising-aggregation.mjs",
      "scan-advertising-reconciliation.mjs"
    ];

    for (const scriptName of activeScripts) {
      const content = fs.readFileSync(path.join(scriptsDir, scriptName), "utf-8");
      expect(content).toContain("resolveAdvertisingProductionComposition");
      expect(content).toContain("LOCKED");
    }
  });
});
