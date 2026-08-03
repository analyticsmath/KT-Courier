/** In-memory retry state only; no payment fields or browser storage are used. */
export type PaymentOperationIdStore = Readonly<{
  get(action: "prepare" | "checkout", material: string): string;
  clear(action: "prepare" | "checkout"): void;
}>;

export function createPaymentOperationIdStore(
  createId: () => string = () => crypto.randomUUID(),
): PaymentOperationIdStore {
  const entries = new Map<string, { material: string; id: string }>();
  return Object.freeze({
    get(action, material) {
      const current = entries.get(action);
      if (current?.material === material) return current.id;
      const id = createId();
      entries.set(action, { material, id });
      return id;
    },
    clear(action) { entries.delete(action); },
  });
}
