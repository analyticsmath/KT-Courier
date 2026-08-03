import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const route = (name: string) => readFileSync(resolve(process.cwd(), `app/api/admin/store-orders/[reference]/${name}/route.ts`), "utf8");

describe("store-order admin recovery routes", () => {
  it.each([
    ["rescan", "STORE_ORDERS_RESCAN", "createStoreOrderReconciliationCase"],
    ["retry-adjustment", "STORE_ORDERS_RETRY_ADJUSTMENT", "applyMarketplaceStoreOrderAdjustment"],
    ["retry-refund", "STORE_ORDERS_RETRY_REFUND", "startProviderRefund"],
    ["retry-delivery-creation", "STORE_ORDERS_RETRY_DELIVERY", "createMarketplaceDeliveryBridge"],
    ["reconcile-handoff", "STORE_ORDERS_RECONCILE_HANDOFF", "refreshStoreOrderDriverAssignment"],
  ])("uses explicit permission and canonical service for %s", (name, permission, canonicalService) => {
    const source = route(name);
    expect(source).toContain(permission);
    expect(source).toContain(canonicalService);
    expect(source).toContain('enforceStoreOrderMutation(request, "admin")');
    expect(source).toContain('exactKeys(body, ["operationId"])');
  });
});
