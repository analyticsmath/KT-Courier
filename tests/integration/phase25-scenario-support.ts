export function createDisposablePhase25Scenario(name: string, expected: string) {
  const setup = { name, database: process.env.PHASE25_DISPOSABLE_DATABASE_URL ?? "DISPOSABLE_PHASE25_DATABASE_ONLY", isolated: true };
  return Object.freeze({ setup, async execute(action: string) { return { setup, action, expected }; } });
}
