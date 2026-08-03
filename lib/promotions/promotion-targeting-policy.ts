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

export function evaluateTargeting(targets: TargetDefinition[], line: LineContext): boolean {
  if (targets.some(t => t.type === "ALL_ELIGIBLE_MARKETPLACE_LINES")) {
    return true; // No filtering needed
  }

  let included = false;
  let excluded = false;

  for (const target of targets) {
    let matches = false;
    switch (target.type) {
      case "STORE": matches = line.storeId === target.targetReference; break;
      case "CATEGORY": matches = line.categoryId === target.targetReference; break;
      case "PRODUCT": matches = line.productId === target.targetReference; break;
      case "VARIANT": matches = line.variantId === target.targetReference; break;
      case "DELIVERY_SERVICE_TYPE": matches = line.deliveryServiceType === target.targetReference; break;
      case "DELIVERY_REGION": matches = line.deliveryRegion === target.targetReference; break;
    }

    if (matches) {
      if (target.mode === "INCLUDE") included = true;
      if (target.mode === "EXCLUDE") excluded = true;
    }
  }

  // If there are EXCLUDE rules and one matches, it's excluded
  if (excluded) return false;

  // If there are INCLUDE rules, it must match at least one
  const hasIncludes = targets.some(t => t.mode === "INCLUDE");
  if (hasIncludes && !included) return false;

  return true;
}
