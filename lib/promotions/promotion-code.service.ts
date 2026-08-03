import { assertPromotionsProductionReady } from "./production-lock";

export async function validatePromotionCode(code: string, hmacKey: string): Promise<any> {
  assertPromotionsProductionReady("CODE_VALIDATE");
  return null;
}

export async function resolvePromotionCodeForCheckout(code: string, checkoutContext: any): Promise<any> {
  assertPromotionsProductionReady("CODE_VALIDATE");
  return null;
}
