/** A customer wallet appears once any verified refund or loyalty credit provisions it. */
export function customerRefundWalletDisplayState(wallet: { provisioned: boolean; readable: boolean }) {
  if (!wallet.provisioned) return "EMPTY" as const;
  return wallet.readable ? "AVAILABLE" as const : "UNAVAILABLE" as const;
}
