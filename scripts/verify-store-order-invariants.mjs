import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const service = readFileSync(resolve(process.cwd(), "lib/store-orders/store-order.service.ts"), "utf8");
const financialComposition = readFileSync(resolve(process.cwd(), "lib/store-orders/financial-adjustment-composition.ts"), "utf8");
const compositionRoot = readFileSync(resolve(process.cwd(), "lib/store-orders/composition-root.ts"), "utf8");
const courierService = readFileSync(resolve(process.cwd(), "lib/services/marketplace-courier-order.service.ts"), "utf8");
const required = ["assertSubstitutionPriceCap", "verifyMarketplaceGuestSecret", "assertStoreOrderProductionReady", "projectMarketplaceParentStatus", "courierOrderId", "This function never writes"];
for (const token of required) if (!service.includes(token)) throw new Error(`Store-order invariant implementation is missing ${token}.`);
for (const token of ["reverseCommissionInTransaction", "adjustStoreEarningInTransaction", "createMarketplaceRefundRequest"]) if (!financialComposition.includes(token)) throw new Error(`Financial composition is missing canonical ${token}.`);
for (const token of ["ExistingPhaseFinancialAdjustmentAuthority", "ExistingCourierOrderMarketplaceBridge", "ExistingPhase8MarketplacePickupAuthority"]) if (!compositionRoot.includes(token)) throw new Error(`Production composition root is missing ${token}.`);
for (const token of ["OrderSource.STORE", "prepaidMarketplacePayment", "pricingQuoteId"]) if (!courierService.includes(token)) throw new Error(`Canonical courier creation is missing ${token}.`);
if (service.includes("markDelivered") || service.includes("createPayment")) throw new Error("Phase 21 must not add delivery completion or a second Payment path.");
if (financialComposition.includes("postLedgerJournalWithinTransaction") || financialComposition.includes("ledgerJournal.create")) throw new Error("Phase 21 financial composition must not post journals directly.");
console.log("Phase 21 source invariants passed. Live database and provider proof remain deferred to Phase 26.5.");
