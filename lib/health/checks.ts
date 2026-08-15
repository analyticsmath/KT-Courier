import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { evaluateProductionConfiguration, type SafeConfigurationIssue } from "@/lib/config/production-validation";
import { getReadinessLockRegistry, type ReadinessLockRecord } from "@/lib/security/integration-registry";
import { checkRedisHealth, type RedisHealthStatus } from "@/lib/security/redis-client";

export interface HealthPayload {
  status: "ok";
  service: "kt-couriers";
  timestamp: string;
}

export interface SafeRedisReadiness {
  configured: boolean;
  connected: boolean;
  status: string;
}

export interface ReadinessPayload {
  status: "ready" | "not_ready";
  database: "reachable" | "unreachable";
  redis: SafeRedisReadiness;
}

export interface OperatorReadinessPayload extends ReadinessPayload {
  configuration: "ready" | "blocked";
  capabilities: ReadinessLockRecord[];
  issues: SafeConfigurationIssue[];
}

type ReadinessClient = Pick<PrismaClient, "$queryRaw">;

export function getHealthPayload(): HealthPayload {
  return {
    status: "ok",
    service: "kt-couriers",
    timestamp: new Date().toISOString(),
  };
}

export async function checkReadiness(
  client: ReadinessClient = prisma,
  timeoutMs = 1500
): Promise<ReadinessPayload> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("readiness check timed out"));
    }, timeoutMs);
  });

  const isProd = process.env.NODE_ENV === "production";
  let databaseReachable = false;

  try {
    await Promise.race([client.$queryRaw`SELECT 1`, timeout]);
    databaseReachable = true;
  } catch {
    databaseReachable = false;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  const redisHealth: RedisHealthStatus = await checkRedisHealth().catch(() => ({
    configured: Boolean(process.env.REDIS_URL),
    connected: false,
    status: "UNREACHABLE",
  }));

  const safeRedis: SafeRedisReadiness = {
    configured: redisHealth.configured,
    connected: redisHealth.connected,
    status: redisHealth.status,
  };

  const configuration = evaluateProductionConfiguration();

  // In production, database must be reachable, Redis must be configured & connected, and static config must not be blocked
  let isReady = databaseReachable && !configuration.readinessBlocked;
  if (isProd && (!safeRedis.configured || !safeRedis.connected)) {
    isReady = false;
  }

  return {
    status: isReady ? "ready" : "not_ready",
    database: databaseReachable ? "reachable" : "unreachable",
    redis: safeRedis,
  };
}

export async function checkOperatorReadiness(
  client: ReadinessClient = prisma,
  timeoutMs = 1500
): Promise<OperatorReadinessPayload> {
  const [readiness, configuration] = await Promise.all([
    checkReadiness(client, timeoutMs),
    Promise.resolve(evaluateProductionConfiguration()),
  ]);

  return {
    ...readiness,
    configuration: configuration.readinessBlocked ? "blocked" : "ready",
    capabilities: getReadinessLockRegistry(),
    issues: configuration.issues,
  };
}
