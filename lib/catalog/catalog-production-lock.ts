// KT Courier Production release approval, 2026-10-06. Publication still requires
// moderation, valid prices, READY media, and the database readiness guards.
export const CATALOG_PRODUCTION_VALIDATION_APPROVED = true as const;
export const CATALOG_PRODUCTION_BLOCK_REASON = "CONSOLIDATED_VALIDATION_NOT_APPROVED" as const;

export type CatalogActivationKind = "PRODUCT_TYPE" | "PRODUCT" | "OFFER" | "PRICE" | "PUBLICATION";

export class CatalogProductionLockedError extends Error {
  readonly code = CATALOG_PRODUCTION_BLOCK_REASON;

  constructor(readonly activationKind: CatalogActivationKind) {
    super(`${activationKind} activation is blocked until consolidated validation is approved.`);
    this.name = "CatalogProductionLockedError";
  }
}

export function assertCatalogProductionActivationAllowed(
  activationKind: CatalogActivationKind,
  testApproval?: { approved: true },
): void {
  if (CATALOG_PRODUCTION_VALIDATION_APPROVED || testApproval?.approved === true) return;
  throw new CatalogProductionLockedError(activationKind);
}
