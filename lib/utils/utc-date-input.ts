/** Interpret a datetime-local field labelled UTC without the device timezone. */
export function utcDateInputToIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) {
    throw new Error("Enter a valid UTC date and time.");
  }
  return new Date(`${value}Z`).toISOString();
}
