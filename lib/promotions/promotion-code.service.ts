import { assertPromotionsProductionReady } from "./production-lock";

export async function validatePromotionCode(code: string, hmacKey: string): Promise<unknown> {
  assertPromotionsProductionReady("CODE_VALIDATE");
  void code;
  void hmacKey;
  return null;
}

export async function resolvePromotionCodeForCheckout(code: string, checkoutContext: unknown): Promise<unknown> {
  assertPromotionsProductionReady("CODE_VALIDATE");
  void code;
  void checkoutContext;
  return null;
}
