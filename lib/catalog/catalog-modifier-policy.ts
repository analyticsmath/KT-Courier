import { CatalogPolicyError } from "@/lib/catalog/errors";

export function assertModifierGroup(value: {
  minimumSelections: number;
  maximumSelections: number;
  isRequired: boolean;
}): void {
  if (!Number.isSafeInteger(value.minimumSelections) || !Number.isSafeInteger(value.maximumSelections) || value.minimumSelections < 0 || value.maximumSelections < 1 || value.minimumSelections > value.maximumSelections) {
    throw new CatalogPolicyError("INVALID_MODIFIER_SELECTIONS", "Modifier selection bounds are invalid.");
  }
  if (value.isRequired && value.minimumSelections < 1) {
    throw new CatalogPolicyError("REQUIRED_MODIFIER_EMPTY", "A required modifier group must require at least one selection.");
  }
}

export function assertModifierPrice(value: { amount: string; currency: string }): void {
  if (!/^\d{1,16}\.\d{2}$/.test(value.amount) || value.amount.startsWith("-")) {
    throw new CatalogPolicyError("INVALID_MODIFIER_PRICE", "Modifier price delta must be an exact zero or positive amount.");
  }
  if (value.currency !== "ZAR") throw new CatalogPolicyError("MODIFIER_CURRENCY", "Modifier prices must use ZAR.");
}

