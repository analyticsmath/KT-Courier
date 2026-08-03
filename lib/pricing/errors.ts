export class PricingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 422
  ) {
    super(message);
    this.name = "PricingError";
  }
}

export const pricingError = {
  noRule: () => new PricingError("PRICING_RULE_NOT_FOUND", "No eligible pricing rule is available."),
  ambiguous: () => new PricingError("PRICING_RULE_AMBIGUOUS", "Pricing rules are ambiguous; contact support."),
  invalidRule: (message: string) => new PricingError("INVALID_PRICING_RULE", message),
  route: () => new PricingError("ROUTE_UNAVAILABLE", "A trusted route could not be calculated.", 503),
  quoteRequired: () => new PricingError("QUOTE_REQUIRED", "A valid pricing quote is required."),
  quoteExpired: () => new PricingError("QUOTE_EXPIRED", "This pricing quote has expired."),
  quoteUsed: () => new PricingError("QUOTE_ALREADY_USED", "This pricing quote has already been used.", 409),
  quoteOwner: () => new PricingError("QUOTE_OWNER_MISMATCH", "This pricing quote does not belong to this account.", 403),
  quoteInput: () => new PricingError("QUOTE_INPUT_MISMATCH", "Order details do not match the pricing quote."),
};
