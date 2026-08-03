import { timeoutUnacceptedStoreOrders } from "@/lib/store-orders/store-order.service";

async function main() {
  await timeoutUnacceptedStoreOrders({ operationIdFactory: (reference) => `phase21-timeout-${reference.replace(/[^A-Za-z0-9_-]/g, "").slice(-80)}-${Date.now()}` });
}
void main();
