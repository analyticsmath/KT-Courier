import { CatalogPolicyError } from "@/lib/catalog/errors";

export const CATALOG_MEDIA_PRODUCTION_VALIDATION_APPROVED = false as const;
export const CATALOG_MEDIA_PRODUCTION_BLOCK_REASON = "CONSOLIDATED_VALIDATION_NOT_APPROVED" as const;

export class CatalogMediaProductionLockedError extends CatalogPolicyError {
  constructor(action: "UPLOAD" | "PUBLIC_DELIVERY" | "CLEANUP") {
    super(
      CATALOG_MEDIA_PRODUCTION_BLOCK_REASON,
      `Catalog media ${action.toLocaleLowerCase("en-ZA")} is blocked until consolidated validation is approved.`,
      423,
    );
  }
}

export type InjectedCatalogMediaTestApproval = Readonly<{
  approved: true;
  adapterCode: "DETERMINISTIC_TEST";
}>;

export function assertCatalogMediaProductionActionAllowed(
  action: "UPLOAD" | "PUBLIC_DELIVERY" | "CLEANUP",
  testApproval?: InjectedCatalogMediaTestApproval,
): void {
  if (CATALOG_MEDIA_PRODUCTION_VALIDATION_APPROVED || testApproval?.approved === true) return;
  throw new CatalogMediaProductionLockedError(action);
}
