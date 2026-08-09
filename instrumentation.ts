import { assertProductionConfiguration } from "@/lib/config/production-validation";
import { logApplicationEvent } from "@/lib/observability/logger";

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  assertProductionConfiguration();
  logApplicationEvent({
    level: "INFO",
    event: "application.instrumentation_registered",
    message: "Server instrumentation registered.",
    outcome: "SUCCESS",
  });
}
