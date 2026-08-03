/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { assertPromotionsProductionReady } from "./production-lock";

export async function applyCouponToCart(owner: any, code: string): Promise<any> {
  assertPromotionsProductionReady("EVALUATION");
  return null;
}

export async function removeCouponFromCart(owner: any): Promise<any> {
  assertPromotionsProductionReady("EVALUATION");
  return null;
}

export async function evaluateEligiblePromotions(owner: any): Promise<any> {
  assertPromotionsProductionReady("EVALUATION");
  return {
    eligible: [],
    applied: [],
    rejected: [],
    totalDiscount: "0.00",
  };
}
