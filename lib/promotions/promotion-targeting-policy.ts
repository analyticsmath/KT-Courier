export type TargetType =
  | "STORE"
  | "CATEGORY"
  | "PRODUCT"
  | "VARIANT"
  | "DELIVERY_SERVICE_TYPE"
  | "DELIVERY_REGION"
  | "ALL_ELIGIBLE_MARKETPLACE_LINES";

export type TargetingMode = "INCLUDE" | "EXCLUDE";

export interface TargetDefinition {
  type: TargetType;
  mode: TargetingMode;
  targetReference: string;
}

export interface LineContext {
  storeId: string;
  categoryId: string;
  productId: string;
  variantId: string;
  deliveryServiceType: string;
  deliveryRegion: string;
}

export function evaluateTargeting(
  targets: TargetDefinition[],
  line: LineContext,
): boolean {
  const matches = (t: TargetDefinition) => {
    switch (t.type) {
      case "STORE":
        return line.storeId === t.targetReference;
      case "CATEGORY":
        return line.categoryId === t.targetReference;
      case "PRODUCT":
        return line.productId === t.targetReference;
      case "VARIANT":
        return line.variantId === t.targetReference;
      case "DELIVERY_SERVICE_TYPE":
        return line.deliveryServiceType === t.targetReference;
      case "DELIVERY_REGION":
        return line.deliveryRegion === t.targetReference;
      case "ALL_ELIGIBLE_MARKETPLACE_LINES":
        return true;
    }
  };
  if (targets.some((t) => t.mode === "EXCLUDE" && matches(t))) return false;
  const includes = targets.filter((t) => t.mode === "INCLUDE");
  // Business, merchandise and delivery scopes must each match. A matching
  // business cannot broaden a product/category offer to its entire catalog.
  const groups: TargetType[][] = [
    ["STORE"],
    ["CATEGORY", "PRODUCT", "VARIANT"],
    ["DELIVERY_SERVICE_TYPE"],
    ["DELIVERY_REGION"],
  ];
  return groups.every((types) => {
    const group = includes.filter((t) => types.includes(t.type));
    return !group.length || group.some(matches);
  });
}
