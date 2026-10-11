import { z } from "zod";
import { StoreOrderError } from "./errors";
export const PreapprovedChoicesSchema = z.array(z.object({ offerReference: z.string().min(5).max(128), variantReference: z.string().min(5).max(128), quantity: z.number().int().min(1).max(99) }).strict()).min(1).max(3).refine(choices => new Set(choices.map(choice => choice.offerReference)).size === choices.length);
export type PreapprovedChoice = z.infer<typeof PreapprovedChoicesSchema>[number];
export type FrozenPreapprovedChoice = PreapprovedChoice & { publicationVersion: string; priceVersion: string; unitPrice: string };
export function assertPreapprovedChoice(choices: readonly FrozenPreapprovedChoice[], current: FrozenPreapprovedChoice) {
  if (!choices.some(choice => choice.offerReference === current.offerReference && choice.variantReference === current.variantReference && current.quantity <= choice.quantity && choice.publicationVersion === current.publicationVersion && choice.priceVersion === current.priceVersion && choice.unitPrice === current.unitPrice)) throw new StoreOrderError("STORE_ORDER_PREAPPROVED_CHOICE_REQUIRED", "The replacement must match a current item and quantity explicitly selected by the customer.");
}
