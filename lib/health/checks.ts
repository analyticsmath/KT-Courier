import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { evaluateProductionConfiguration, type SafeConfigurationIssue } from "@/lib/config/production-validation";
import { getReadinessLockRegistry, type ReadinessLockRecord } from "@/lib/security/integration-registry";

export interface HealthPayload {
  status: "ok";
  service: "kt-couriers";
  timestamp: string;
}

export interface ReadinessPayload {
  status: "ready" | "not_ready";
  database: "reachable" | "unreachable";
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

  try {
    await Promise.race([client.$queryRaw`SELECT 1`, timeout]);
    const configuration = evaluateProductionConfiguration();
    return {
      status: configuration.readinessBlocked ? "not_ready" : "ready",
      database: "reachable",
    };
  } catch {
    return { status: "not_ready", database: "unreachable" };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function checkOperatorReadiness(
  client: ReadinessClient = prisma,
  timeoutMs = 1500
): Promise<OperatorReadinessPayload> {
  const [database, configuration] = await Promise.all([
    checkReadiness(client, timeoutMs),
    Promise.resolve(evaluateProductionConfiguration()),
  ]);

  return {
    ...database,
    configuration: configuration.readinessBlocked ? "blocked" : "ready",
    capabilities: getReadinessLockRegistry(),
    issues: configuration.issues,
  };
}
