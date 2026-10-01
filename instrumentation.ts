import { assertProductionConfiguration } from "@/lib/config/production-validation";
import { isVercelProxyRuntime } from "@/lib/config/runtime-surface";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Vercel has no database by design: its request proxy forwards to Railway.
  // Railway and any Vercel deployment with a database retain strict validation.
  if (isVercelProxyRuntime()) return;
  // Keep the Node-only crypto dependency out of the Edge instrumentation bundle.
  const { logApplicationEvent } = await import("@/lib/observability/logger");
  assertProductionConfiguration();
  logApplicationEvent({
    level: "INFO",
    event: "application.instrumentation_registered",
    message: "Server instrumentation registered.",
    outcome: "SUCCESS",
  });
}
