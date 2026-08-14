import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("Phase B COD runtime-proof source contract", () => {
  it("retains production transaction authorities for commitment, verified activation, collection and reconciliation", () => {
    const service = read("lib/services/cash-on-delivery.service.ts");
    const payment = read("lib/services/payfast-itn-application.service.ts");
    expect(service).toMatch(/createCashOnDeliveryObligationWithinTransaction/);
    expect(service).toMatch(/activateDepositCashOnDeliveryWithinTransaction/);
    expect(service).toMatch(/recordCashCollection/);
    expect(service).toMatch(/reconcileCashCollection/);
    expect(service).toMatch(/FOR UPDATE/);
    expect(service).toMatch(/withLedgerRetry/);
    expect(payment).toMatch(/activateDepositCashOnDeliveryWithinTransaction/);
  });

  it("keeps collection and reconciliation API routes thin and permission-protected", () => {
    const collect = read("app/api/driver/orders/[orderId]/cod/collection/route.ts");
    const reconcile = read("app/api/admin/orders/[orderId]/cod/reconcile/route.ts");
    expect(collect).toMatch(/recordCashCollection/);
    expect(collect).toMatch(/RATE_LIMITS\.COD_COLLECTION/);
    expect(reconcile).toMatch(/reconcileCashCollection/);
    expect(reconcile).toMatch(/PERMISSIONS\.COD_OPERATIONS_MANAGE/);
  });
});
