/**
 * Exactly-once ledger projection for non-monetary customer loyalty points.
 * A later refund never blocks because already-redeemed points are converted
 * into debt to be recovered from future earnings, not negative spendable points.
 */
export type LoyaltyPointBalance = Readonly<{
  availablePoints: bigint;
  debtPoints: bigint;
  lifetimeEarnedPoints: bigint;
  lifetimeReversedPoints: bigint;
}>;

const MAX_POINTS = 9223372036854775807n;

export function reconcileLoyaltyPointBalance(input: Readonly<{
  balance: LoyaltyPointBalance;
  previouslyRecognizedPoints: bigint;
  recomputedRecognizedPoints: bigint;
}>): Readonly<LoyaltyPointBalance & { deltaPoints: bigint }> {
  const { balance } = input;
  const values = [
    balance.availablePoints, balance.debtPoints,
    balance.lifetimeEarnedPoints, balance.lifetimeReversedPoints,
    input.previouslyRecognizedPoints, input.recomputedRecognizedPoints,
  ];
  if (values.some(value => value < 0n || value > MAX_POINTS)
    || (balance.availablePoints > 0n && balance.debtPoints > 0n)) {
    throw new Error("Loyalty account or source state is not coherent.");
  }
  const deltaPoints = input.recomputedRecognizedPoints - input.previouslyRecognizedPoints;
  let availablePoints = balance.availablePoints;
  let debtPoints = balance.debtPoints;
  let lifetimeEarnedPoints = balance.lifetimeEarnedPoints;
  let lifetimeReversedPoints = balance.lifetimeReversedPoints;

  if (deltaPoints > 0n) {
    const paidDebt = deltaPoints < debtPoints ? deltaPoints : debtPoints;
    debtPoints -= paidDebt;
    availablePoints += deltaPoints - paidDebt;
    lifetimeEarnedPoints += deltaPoints;
  } else if (deltaPoints < 0n) {
    const reversal = -deltaPoints;
    const removed = reversal < availablePoints ? reversal : availablePoints;
    availablePoints -= removed;
    debtPoints += reversal - removed;
    lifetimeReversedPoints += reversal;
  }
  if ([availablePoints, debtPoints, lifetimeEarnedPoints, lifetimeReversedPoints].some(value => value > MAX_POINTS)) {
    throw new Error("Loyalty points are outside the supported database range.");
  }
  return Object.freeze({
    availablePoints, debtPoints, lifetimeEarnedPoints, lifetimeReversedPoints, deltaPoints,
  });
}
