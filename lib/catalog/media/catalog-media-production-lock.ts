import { CatalogPolicyError } from "@/lib/catalog/errors";
import { isDemoMediaDeliveryAllowed } from "@/lib/runtime/deployment-classification";

export const CATALOG_MEDIA_PRODUCTION_VALIDATION_APPROVED = true as const;
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

export function isCatalogMediaDeliveryAllowed(env: Record<string, string | undefined> = process["env"]): boolean {
  if (CATALOG_MEDIA_PRODUCTION_VALIDATION_APPROVED) return true;
  return isDemoMediaDeliveryAllowed(env, CATALOG_MEDIA_PRODUCTION_VALIDATION_APPROVED);
}

export function assertCatalogMediaProductionActionAllowed(
  action: "UPLOAD" | "PUBLIC_DELIVERY" | "CLEANUP",
  testApproval?: InjectedCatalogMediaTestApproval,
  env: Record<string, string | undefined> = process["env"],
): void {
  if (CATALOG_MEDIA_PRODUCTION_VALIDATION_APPROVED || testApproval?.approved === true) return;
  if (action === "PUBLIC_DELIVERY" && isCatalogMediaDeliveryAllowed(env)) return;
  throw new CatalogMediaProductionLockedError(action);
}

