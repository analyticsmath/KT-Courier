import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const path = "prisma/migrations/20261108161000_promotion_multi_campaign_idempotency/migration.sql";
const migration = readFileSync(path, "utf8").replace(/--.*$/gm, "").trim();
const compact = migration.replace(/\s+/g, " ");

describe("promotion multi-campaign migration atomic index replacement", () => {
  it("builds both replacement indexes before retiring old unique indexes inside a transaction", () => {
    expect(compact).toMatch(/^BEGIN;/i);
    expect(compact).toMatch(/COMMIT;$/i);
    const changes = [
      [
        'CREATE UNIQUE INDEX "PromotionReservation_operation_campaign_key"',
        'DROP INDEX IF EXISTS "PromotionReservation_operationId_key"',
      ],
      [
        'CREATE INDEX "PromotionRedemption_operationId_idx"',
        'DROP INDEX IF EXISTS "PromotionRedemption_operationId_key"',
      ],
    ];
    for (const [create, drop] of changes) {
      expect(compact.indexOf(create)).toBeGreaterThan(0);
      expect(compact.indexOf(drop)).toBeGreaterThan(compact.indexOf(create));
    }
    expect(compact.match(/\bDROP\s+INDEX\b/gi)).toHaveLength(2);
    expect(compact).not.toMatch(/\bDROP\s+(TABLE|COLUMN|TYPE|CONSTRAINT)\b/i);
    expect(compact).not.toMatch(/\b(TRUNCATE|DELETE\s+FROM)\b/i);
  });

  it("keeps exact, narrowly approved migration safety patterns", () => {
    const checker = readFileSync("scripts/check-migrations-safety.mjs", "utf8");
    expect(checker).toContain("20261108161000_promotion_multi_campaign_idempotency");
    expect(checker).toContain("PromotionReservation_operationId_key");
    expect(checker).toContain("PromotionRedemption_operationId_key");
    expect(checker).toContain("approvedDestructiveOperation");
  });
});
