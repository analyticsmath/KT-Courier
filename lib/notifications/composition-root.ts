/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/prisma";
import { NotConfiguredEmailProvider, NotConfiguredPushProvider, NotConfiguredSmsProvider } from "./providers";
import { createPrismaNotificationRepositories } from "./repositories";
import { NOTIFICATION_PRODUCTION_BLOCK_REASON, assertNotificationProductionReady } from "./production-readiness";
import { createNotificationAuthority } from "./authority";
import { NotificationProcessorService } from "./processor.service";

/** Dependency order is intentionally explicit: no provider can be reached before policy and delivery authority exist. */
export const NOTIFICATION_PRODUCTION_COMPOSITION_ORDER = [
  "concrete Prisma notification repositories",
  "canonical User and verified-contact authority",
  "role-profile recipient adapters",
  "concrete encryption or secret authority",
  "concrete strict template renderer",
  "preference and consent services",
  "source-event adapters",
  "recipient-policy service",
  "concrete inbox authority",
  "production email adapter",
  "production SMS adapter",
  "production push adapter",
  "delivery service",
  "receipt ingestion",
  "suppression service",
  "reconciliation service",
  "processor suite",
] as const;

export function resolveNotificationProductionComposition() {
  const database: any = prisma;
  const repositories = createPrismaNotificationRepositories(database);
  const providers = new Map<any, any>([["EMAIL", new NotConfiguredEmailProvider()], ["SMS", new NotConfiguredSmsProvider()], ["WEB_PUSH", new NotConfiguredPushProvider("WEB_PUSH")], ["ANDROID_PUSH", new NotConfiguredPushProvider("ANDROID_PUSH")]]);
  const authority = createNotificationAuthority(database, providers);
  const services = Object.freeze({ ...authority, processors: new NotificationProcessorService(database, authority) });
  try { assertNotificationProductionReady(); return Object.freeze({ status: "READY" as const, database, repositories, providers, services }); }
  catch { return Object.freeze({ status: "LOCKED" as const, code: NOTIFICATION_PRODUCTION_BLOCK_REASON, database, repositories, providers, services }); }
}
