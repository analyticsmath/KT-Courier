import { type NextRequest } from "next/server";
import { prepareMarketplacePayment } from "@/lib/marketplace-checkout/checkout.service";
import { assertExactKeys, enforceMarketplaceMutation, integerField, marketplaceError, marketplaceOwner, readMarketplaceJson, stringField } from "@/lib/marketplace-checkout/api-policy";
import { PaymentChannelSchema } from "@/lib/validation/payments";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const limited = await enforceMarketplaceMutation(request, "reservation");
  if (limited) return limited;
  try {
    const owner = await marketplaceOwner(request, "checkout");
    if (!owner) throw new Error("Checkout access is required.");
    const body = await readMarketplaceJson(request);
    assertExactKeys(body, ["checkoutVersion", "operationId", "requestHash", "walletAmount", "channel"]);
    const { reference } = await context.params;
    const walletAmount = typeof body.walletAmount === "string" && body.walletAmount.trim()
      ? body.walletAmount.trim()
      : undefined;
    let channel: "CARD" | "EFT" | undefined;
    if (body.channel !== undefined) {
      const parsedChannel = PaymentChannelSchema.safeParse(body.channel);
      if (!parsedChannel.success) {
        throw new MarketplaceCheckoutError("CART_LINE_INVALID", "Invalid payment channel.");
      }
      channel = parsedChannel.data;
    }
    const result = await prepareMarketplacePayment({
      reference,
      owner,
      expectedVersion: integerField(body, "checkoutVersion"),
      operationId: stringField(body, "operationId", 120),
      requestHash: stringField(body, "requestHash", 200),
      walletAmount,
      ...(channel ? { channel } : {}),
    });
    return Response.json(result);
  } catch (error) {
    return marketplaceError(error);
  }
}
