import { assertProductionConfiguration } from "@/lib/config/production-validation";
import { isVercelProxyRuntime } from "@/lib/config/runtime-surface";
import { logApplicationEvent } from "@/lib/observability/logger";

/** Stateful servers require production validation; a Vercel proxy has no DB. */
export async function registerNodeInstrumentation(): Promise<void> {
  if (isVercelProxyRuntime()) return;
  assertProductionConfiguration();
  logApplicationEvent({
    level: "INFO",
    event: "application.instrumentation_registered",
    message: "Server instrumentation registered.",
    outcome: "SUCCESS",
  });
}
