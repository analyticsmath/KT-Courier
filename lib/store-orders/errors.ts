export class StoreOrderError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "StoreOrderError";
  }
}

export function assertStoreOrder(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new StoreOrderError(code, message);
}
