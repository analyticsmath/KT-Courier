const formatMoney = (amount: string) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(amount));

export function CheckoutPaymentSummary({ digitalRequired, cashRequired }: { digitalRequired: string; cashRequired: string }) {
  if (Number(cashRequired) <= 0) return null;
  return <dl aria-label="Payment schedule" style={{ margin: "1rem 0", fontSize: "0.9rem" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><dt>Pay online today</dt><dd style={{ margin: 0 }}>{formatMoney(digitalRequired)}</dd></div>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 8 }}><dt>Cash due on delivery</dt><dd style={{ margin: 0 }}>{formatMoney(cashRequired)}</dd></div>
  </dl>;
}
