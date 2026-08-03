import { DispatchError } from "./errors";

export async function withDispatchRetry<T>(operation: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try { return await operation(); } catch (error) {
      const code = (error as { code?: string }).code;
      if (error instanceof DispatchError || attempt >= retries || !["P2034", "40001", "40P01"].includes(code ?? "")) throw error;
    }
  }
}
