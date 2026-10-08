/** No production configuration may select the persisted offline provider. */
export function assertDisposablePaystackAcceptance(env: Readonly<Record<string, string | undefined>> = process.env): void {
  const database = new URL(env.DATABASE_URL ?? "invalid:");
  const origin = new URL(env.PAYMENT_APP_ORIGIN ?? "invalid:");
  if (env.KT_E2E_PAYSTACK_ACCEPTANCE !== "true" || env.KT_RUNTIME_ENV !== "e2e" ||
      env.NODE_ENV !== "test" || env.KT_NETWORK_DISABLED !== "true" ||
      env.KT_E2E_NETWORK_INTERNAL !== "true" || env.KT_LOCAL_FULL_FLOW !== "false" ||
      env.PAYSTACK_MODE !== "test" || env.PAYSTACK_SECRET_KEY !== "sk_test_disposable_browser_no_provider" ||
      database.protocol !== "postgresql:" || database.pathname !== "/kt_phase75_e2e" ||
      database.username !== "kt_phase75_e2e" ||
      !["db", "localhost", "127.0.0.1"].includes(database.hostname) ||
      origin.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(origin.hostname)) {
    throw new Error("Offline Paystack acceptance requires the named, isolated disposable browser runtime.");
  }
}

export const disposablePaystackKey = (reference: string) => `e2e-paystack-provider:${reference}`;
export function assertDisposablePaystackEmail(email: string): void {
  if (!/^e2e-paystack-[a-z0-9-]+@ktcouriers\.local$/.test(email)) {
    throw new Error("Offline Paystack accepts only namespace-owned synthetic contacts.");
  }
}
