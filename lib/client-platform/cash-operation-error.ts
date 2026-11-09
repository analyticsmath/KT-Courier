/**
 * A transport failure is an unknown outcome, not proof that a bank deposit
 * failed. The caller retains its operation ID and the original private receipt
 * reference for a safe, idempotent replay.
 */
export function cashOperationErrorMessage(error: unknown): string {
  if (error instanceof TypeError ||
      (error instanceof Error && /^(?:Failed to fetch|NetworkError(?: when attempting to fetch resource\.)?|Load failed)$/i.test(error.message))) {
    return "The cash operation could not be confirmed because the connection was interrupted. Retry with the same deposit details; no second receipt upload is required.";
  }
  return error instanceof Error && error.message.trim()
    ? error.message
    : "The cash operation could not be saved. Please retry.";
}
