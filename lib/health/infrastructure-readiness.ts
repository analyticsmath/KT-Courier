import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { checkRedisHealth } from "@/lib/security/redis-client";

export type InfrastructureReadiness = Readonly<{
  status: "ready" | "not_ready";
  database: "reachable" | "unreachable";
  redis: "connected" | "unreachable";
}>;

type DatabaseProbe = Pick<PrismaClient, "$queryRaw">;
type RedisProbe = () => Promise<{ configured: boolean; connected: boolean }>;

async function bounded<T>(probe: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      probe,
      new Promise<null>((resolve) => { timeout = setTimeout(() => resolve(null), timeoutMs); }),
    ]);
  } catch {
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/** Deployment health is deliberately infrastructure-only. The financial and
 * regulatory gates continue to use /api/ready and their own fail-closed checks. */
export async function checkInfrastructureReadiness(
  database: DatabaseProbe = prisma,
  redisProbe: RedisProbe = checkRedisHealth,
  timeoutMs = 3500,
): Promise<InfrastructureReadiness> {
  const [query, redis] = await Promise.all([
    bounded(Promise.resolve().then(() => database.$queryRaw`SELECT 1`), timeoutMs),
    bounded(Promise.resolve().then(redisProbe), timeoutMs),
  ]);
  const databaseReachable = query !== null;
  const redisConnected = redis?.configured === true && redis.connected === true;
  return {
    status: databaseReachable && redisConnected ? "ready" : "not_ready",
    database: databaseReachable ? "reachable" : "unreachable",
    redis: redisConnected ? "connected" : "unreachable",
  };
}
