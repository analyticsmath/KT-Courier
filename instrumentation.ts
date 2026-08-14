import { assertProductionConfiguration } from "@/lib/config/production-validation";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
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
