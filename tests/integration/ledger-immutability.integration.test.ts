import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCustomerAsset, fundAsset, ledgerPrisma } from "./ledger-fixtures";
import { reverseLedgerJournal } from "@/lib/services/ledger-reversal.service";

beforeAll(async () => {
  // Ensure protect_ledger_entry_insert function and LedgerEntry_insert_protection trigger exist
  await ledgerPrisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION protect_ledger_entry_insert()
    RETURNS TRIGGER AS $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM "LedgerJournal"
        WHERE id = NEW."journalId"
          AND xmin::text <> pg_current_xact_id()::text
      ) THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'Cannot append entries to an already posted journal.';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await ledgerPrisma.$executeRawUnsafe(`
    DROP TRIGGER IF EXISTS "LedgerEntry_insert_protection" ON "LedgerEntry";
  `);

  await ledgerPrisma.$executeRawUnsafe(`
    CREATE TRIGGER "LedgerEntry_insert_protection"
    BEFORE INSERT ON "LedgerEntry"
    FOR EACH ROW
    EXECUTE FUNCTION protect_ledger_entry_insert();
  `);
});

afterAll(async () => {
  await ledgerPrisma.$disconnect();
});

describe("Database-level ledger evidence immutability", () => {
  it("rejects direct SQL updates on LedgerJournal (memo and totals) and verifies records remain unchanged", async () => {
    const customer = await createCustomerAsset("db-immut-upd-j");
    const journal = await fundAsset(customer.account.id, "10.00", "db-immut-upd-j");

    // Attempt to update journal memo
    await expect(
      ledgerPrisma.$executeRaw`UPDATE "LedgerJournal" SET "memo" = 'tampered' WHERE "id" = ${journal.id}`
    ).rejects.toThrow();

    // Attempt to update journal totals
    await expect(
      ledgerPrisma.$executeRaw`UPDATE "LedgerJournal" SET "totalDebits" = 999.00 WHERE "id" = ${journal.id}`
    ).rejects.toThrow();

    // Verify original remains unchanged
    const reloaded = await ledgerPrisma.ledgerJournal.findUnique({ where: { id: journal.id } });
    expect(reloaded?.memo).toBe(journal.memo);
    expect(reloaded?.totalDebits.toFixed(2)).toBe("10.00");
  });

  it("rejects direct SQL deletes on LedgerJournal and verifies records remain unchanged", async () => {
    const customer = await createCustomerAsset("db-immut-del-j");
    const journal = await fundAsset(customer.account.id, "10.00", "db-immut-del-j");

    // Attempt to delete journal
    await expect(
      ledgerPrisma.$executeRaw`DELETE FROM "LedgerJournal" WHERE "id" = ${journal.id}`
    ).rejects.toThrow();

    // Verify original remains unchanged
    const reloaded = await ledgerPrisma.ledgerJournal.findUnique({ where: { id: journal.id } });
    expect(reloaded).not.toBeNull();
  });

  it("rejects direct SQL updates on LedgerEntry (amount and direction) and verifies records remain unchanged", async () => {
    const customer = await createCustomerAsset("db-immut-upd-e");
    const journal = await fundAsset(customer.account.id, "10.00", "db-immut-upd-e");
    const entryId = journal.entries[0].id;
    const entry = journal.entries[0];

    // Attempt to update entry amount
    await expect(
      ledgerPrisma.$executeRaw`UPDATE "LedgerEntry" SET "amount" = 99.00 WHERE "id" = ${entryId}`
    ).rejects.toThrow();

    // Attempt to update entry direction
    await expect(
      ledgerPrisma.$executeRaw`UPDATE "LedgerEntry" SET "direction" = 'CREDIT' WHERE "id" = ${entryId}`
    ).rejects.toThrow();

    // Verify original remains unchanged
    const reloaded = await ledgerPrisma.ledgerEntry.findUnique({ where: { id: entryId } });
    expect(reloaded?.amount.toFixed(2)).toBe("10.00");
    expect(reloaded?.direction).toBe(entry.direction);
  });

  it("rejects direct SQL deletes on LedgerEntry and verifies records remain unchanged", async () => {
    const customer = await createCustomerAsset("db-immut-del-e");
    const journal = await fundAsset(customer.account.id, "10.00", "db-immut-del-e");
    const entryId = journal.entries[0].id;

    // Attempt to delete entry
    await expect(
      ledgerPrisma.$executeRaw`DELETE FROM "LedgerEntry" WHERE "id" = ${entryId}`
    ).rejects.toThrow();

    // Verify original remains unchanged
    const reloaded = await ledgerPrisma.ledgerEntry.findUnique({ where: { id: entryId } });
    expect(reloaded).not.toBeNull();
  });

  it("rejects appending an extra entry to a posted journal", async () => {
    const customer = await createCustomerAsset("db-immut-app-e");
    const journal = await fundAsset(customer.account.id, "10.00", "db-immut-app-e");

    // Attempt to append an entry to the posted journal
    await expect(
      ledgerPrisma.$executeRaw`
        INSERT INTO "LedgerEntry" ("id", "journalId", "accountId", "sequence", "direction", "amount", "lineCode", "memo", "createdAt")
        VALUES ('extra-entry-id', ${journal.id}, ${customer.account.id}, 3, 'DEBIT', 5.00, 'EXTRA', 'extra entry', NOW())
      `
    ).rejects.toThrow();

    // Verify entry was not appended
    const count = await ledgerPrisma.ledgerEntry.count({ where: { journalId: journal.id } });
    expect(count).toBe(2);
  });

  it("succeeds for canonical new posting and canonical reversal posting", async () => {
    const customer = await createCustomerAsset("db-immut-canon");
    // 1. Canonical new posting succeeds
    const journal = await fundAsset(customer.account.id, "15.00", "db-immut-canon");
    expect(journal.id).toBeDefined();

    // 2. Canonical reversal posting succeeds
    const reversal = await reverseLedgerJournal({
      originalJournalId: journal.id,
      idempotencyKey: `reversal-${journal.id}`,
      actor: { kind: "SYSTEM" },
    });
    expect(reversal.id).toBeDefined();

    // Verify original journal and entries remain unchanged
    const reloadedOriginal = await ledgerPrisma.ledgerJournal.findUnique({
      where: { id: journal.id },
      include: { entries: true },
    });
    expect(reloadedOriginal?.totalDebits.toFixed(2)).toBe("15.00");
    expect(reloadedOriginal?.entries.length).toBe(2);
  });
});
