import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export interface HealthPayload {
  status: "ok";
  service: "kt-couriers";
  timestamp: string;
  environment: string;
}

export interface ReadinessPayload {
  status: "ready" | "not_ready";
  database: "reachable" | "unreachable";
}

type ReadinessClient = Pick<PrismaClient, "$queryRaw">;

export function getHealthPayload(): HealthPayload {
  return {
    status: "ok",
    service: "kt-couriers",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
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
    return { status: "ready", database: "reachable" };
  } catch {
    return { status: "not_ready", database: "unreachable" };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
