import Redis, { type RedisOptions } from "ioredis";

let redisClient: Redis | null = null;

export interface RedisHealthStatus {
  configured: boolean;
  connected: boolean;
  status: string;
  error?: string;
}

/**
 * Returns whether REDIS_URL environment variable is present.
 */
export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL && process.env.REDIS_URL.trim() !== "");
}

/**
 * Redacts credentials from a Redis connection string for safe logging.
 */
export function redactRedisUrl(rawUrl?: string): string {
  if (!rawUrl) return "NOT_CONFIGURED";
  try {
    const parsed = new URL(rawUrl);
    if (parsed.password) parsed.password = "REDACTED";
    if (parsed.username) parsed.username = "REDACTED";
    return parsed.toString();
  } catch {
    return "[MALFORMED_REDIS_URL]";
  }
}

/**
 * Obtains or creates the singleton Redis client instance with bounded timeouts and retries.
 */
export function getRedisClient(): Redis | null {
  if (!isRedisConfigured()) {
    return null;
  }

  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL!;
  const options: RedisOptions = {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    connectTimeout: 3000,
    commandTimeout: 2000,
    enableOfflineQueue: false,
    retryStrategy(times) {
      if (times > 3) return null; // stop retrying after 3 attempts
      return Math.min(times * 100, 1000);
    },
  };

  try {
    redisClient = new Redis(redisUrl, options);
    redisClient.on("error", (err: unknown) => {
      // Bounded error logging without leaking connection secrets
      if (process.env.NODE_ENV !== "test") {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[REDIS_WARNING] Redis connection error: ${message}`);
      }
    });
    return redisClient;
  } catch {
    return null;
  }
}

/**
 * Checks Redis connectivity and ping response without throwing.
 */
export async function checkRedisHealth(): Promise<RedisHealthStatus> {
  if (!isRedisConfigured()) {
    return {
      configured: false,
      connected: false,
      status: "NOT_CONFIGURED",
    };
  }

  const client = getRedisClient();
  if (!client) {
    return {
      configured: true,
      connected: false,
      status: "INIT_FAILED",
      error: "Unable to initialize Redis client",
    };
  }

  try {
    if (client.status === "wait" || client.status === "close") {
      await client.connect();
    }
    const pingResult = await client.ping();
    return {
      configured: true,
      connected: pingResult === "PONG",
      status: pingResult === "PONG" ? "HEALTHY" : "UNHEALTHY",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ping failed";
    return {
      configured: true,
      connected: false,
      status: "UNREACHABLE",
      error: message,
    };
  }
}

/**
 * Gracefully disconnects the Redis client (useful for tests and cleanup).
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    try {
      if (redisClient.status !== "end") {
        await redisClient.quit();
      }
    } catch {
      redisClient.disconnect();
    } finally {
      redisClient = null;
    }
  }
}
