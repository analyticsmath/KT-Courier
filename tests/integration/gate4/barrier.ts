import { PrismaClient } from "@prisma/client";

export interface RaceResult<T> {
  index: number;
  status: "fulfilled" | "rejected";
  value?: T;
  reason?: unknown;
}

export class ConcurrencyBarrier {
  private currentCount = 0;
  private readonly targetCount: number;
  private releasePromise: Promise<void>;
  private resolveRelease!: () => void;
  private rejectRelease!: (reason?: unknown) => void;
  private timer?: ReturnType<typeof setTimeout>;
  private isSettled = false;

  constructor(targetCount: number, timeoutMs = 15000) {
    this.targetCount = targetCount;
    this.releasePromise = new Promise<void>((resolve, reject) => {
      this.resolveRelease = () => {
        if (!this.isSettled) {
          this.isSettled = true;
          if (this.timer) clearTimeout(this.timer);
          resolve();
        }
      };
      this.rejectRelease = (reason) => {
        if (!this.isSettled) {
          this.isSettled = true;
          if (this.timer) clearTimeout(this.timer);
          reject(reason);
        }
      };
    });

    if (timeoutMs > 0) {
      this.timer = setTimeout(() => {
        if (!this.isSettled) {
          this.rejectRelease(
            new Error(`ConcurrencyBarrier timeout: expected ${this.targetCount} participants, but only ${this.currentCount} arrived within ${timeoutMs}ms.`)
          );
        }
      }, timeoutMs);
    }
  }

  async wait(): Promise<void> {
    if (this.isSettled) {
      return this.releasePromise;
    }
    this.currentCount += 1;
    if (this.currentCount >= this.targetCount) {
      this.resolveRelease();
    }
    return this.releasePromise;
  }

  cancel(reason?: unknown): void {
    this.rejectRelease(reason ?? new Error("ConcurrencyBarrier cancelled due to worker failure prior to barrier checkpoint."));
  }
}

/**
 * Creates N independent PrismaClients for concurrent connection testing.
 */
export function createIndependentClients(count: number): PrismaClient[] {
  const dbUrl = process.env.DATABASE_URL;
  const clients: PrismaClient[] = [];
  for (let i = 0; i < count; i += 1) {
    clients.push(
      new PrismaClient({
        datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
        log: [],
      })
    );
  }
  return clients;
}

/**
 * Cleanly disconnects an array of PrismaClients.
 */
export async function closeIndependentClients(clients: PrismaClient[]): Promise<void> {
  await Promise.all(
    clients.map(async (client) => {
      try {
        await client.$disconnect();
      } catch {
        // Ignore disconnect errors during teardown
      }
    })
  );
}

/**
 * Runs N operations concurrently using a synchronization barrier and collects settled results.
 */
export async function runConcurrentRace<T>(
  count: number,
  task: (client: PrismaClient, index: number, barrier: ConcurrencyBarrier) => Promise<T>,
  clients?: PrismaClient[]
): Promise<RaceResult<T>[]> {
  const activeClients = clients ?? createIndependentClients(count);
  const barrier = new ConcurrencyBarrier(count);

  try {
    const promises = activeClients.map(async (client, index) => {
      try {
        const value = await task(client, index, barrier);
        return { index, status: "fulfilled" as const, value };
      } catch (reason) {
        barrier.cancel(reason);
        return { index, status: "rejected" as const, reason };
      }
    });

    return await Promise.all(promises);
  } finally {
    if (!clients) {
      await closeIndependentClients(activeClients);
    }
  }
}
