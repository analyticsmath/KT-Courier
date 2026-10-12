import { AsyncLocalStorage } from "node:async_hooks";

/** Keep a reusable repository's delegates bound to its calling transaction. */
export function createTransactionContext<T extends object>(database: T) {
  const context = new AsyncLocalStorage<T>();
  const db = new Proxy(database, {
    get(_target, key) {
      const client = context.getStore() ?? database;
      const value = Reflect.get(client, key);
      return typeof value === "function" ? value.bind(client) : value;
    },
  });
  return { db, run: <R>(transaction: T, work: () => Promise<R>) => context.run(transaction, work) };
}
