/** An unprovisioned refund-only wallet is expected until a refund is due. */
export function customerRefundWalletDisplayState(wallet: { provisioned: boolean; readable: boolean }) {
  if (!wallet.provisioned) return "EMPTY" as const;
  return wallet.readable ? "AVAILABLE" as const : "UNAVAILABLE" as const;
}
