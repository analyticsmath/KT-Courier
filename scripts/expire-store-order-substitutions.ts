import { expireStoreOrderSubstitutions } from "@/lib/store-orders/store-order.service";

async function main() {
  await expireStoreOrderSubstitutions({ operationIdFactory: (reference) => `phase21-substitution-expiry-${reference.replace(/[^A-Za-z0-9_-]/g, "").slice(-70)}-${Date.now()}` });
}
void main();
