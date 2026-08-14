import { expect } from "vitest";
import { ManagedMarketingRequestError } from "@/lib/advertising/managed-marketing.service";

export async function expectManagedMarketingError(action: Promise<unknown>, expectedCode: string) {
  try {
    await action;
  } catch (error) {
    expect(error).toBeInstanceOf(ManagedMarketingRequestError);
    expect((error as ManagedMarketingRequestError).code).toBe(expectedCode);
    return;
  }
  throw new Error(`Expected ManagedMarketingRequestError(${expectedCode})`);
}
