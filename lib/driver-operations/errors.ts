export class DriverOperationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "DRIVER_OPERATION_FORBIDDEN"
      | "DRIVER_OPERATION_STALE"
      | "DRIVER_OPERATION_IDEMPOTENCY_CONFLICT"
      | "DRIVER_OPERATION_TERMINAL"
      | "DRIVER_OPERATION_INVALID_STATE"
  ) {
    super(message);
    this.name = "DriverOperationError";
  }
}
