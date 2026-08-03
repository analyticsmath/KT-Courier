import { normalizeCatalogKey } from "@/lib/catalog/catalog-normalization";

export const PROHIBITED_CATALOG_TERMS = [
  "weapon",
  "ammunition",
  "illegal goods",
  "controlled substance",
  "prescription medicine",
  "tobacco",
  "nicotine",
  "alcohol",
  "counterfeit",
  "recalled goods",
] as const;

export type ComplianceRequirement = {
  code: string;
  required: boolean;
  appliesToConditions?: string[];
};

export type CatalogComplianceResult = {
  allowed: boolean;
  blockingCodes: string[];
};

export function evaluateCatalogCompliance(args: {
  categoryPath: string;
  title: string;
  description?: string | null;
  condition: string;
  values: Record<string, unknown>;
  requirements: ComplianceRequirement[];
}): CatalogComplianceResult {
  const source = normalizeCatalogKey(`${args.categoryPath} ${args.title} ${args.description ?? ""}`);
  const blockingCodes: string[] = [];
  if (PROHIBITED_CATALOG_TERMS.some((term) => source.includes(term))) blockingCodes.push("PROHIBITED_PRODUCT");
  for (const requirement of args.requirements) {
    const applies = !requirement.appliesToConditions || requirement.appliesToConditions.includes(args.condition);
    const value = args.values[requirement.code];
    if (applies && requirement.required && (value === undefined || value === null || value === "")) {
      blockingCodes.push(`COMPLIANCE_REQUIRED:${requirement.code}`);
    }
  }
  if (["REFURBISHED", "RECONDITIONED"].includes(args.condition) && !args.values.condition_disclosure) {
    blockingCodes.push("CONDITION_DISCLOSURE_REQUIRED");
  }
  return { allowed: blockingCodes.length === 0, blockingCodes };
}

