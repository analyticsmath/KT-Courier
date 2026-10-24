/** datetime-local omits its timezone. Evidence inputs explicitly use UTC so
 * operator/browser timezone differences cannot move an observation into future. */
export function parseEvidenceUtcInput(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) throw new Error("Enter a valid UTC date and time.");
  const parsed = new Date(`${value}Z`);
  if (Number.isNaN(parsed.valueOf())) throw new Error("Enter a valid UTC date and time.");
  const iso = parsed.toISOString();
  if (iso.slice(0, value.length) !== value) throw new Error("Enter a valid UTC date and time.");
  return iso;
}
