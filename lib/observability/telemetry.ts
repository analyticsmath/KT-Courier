import { logApplicationEvent } from "./logger";

export interface TelemetryObservation {
  name: string;
  value?: number;
  outcome?: "SUCCESS" | "FAILURE" | "DENIED" | "UNAVAILABLE";
  attributes?: Record<string, string | number | boolean>;
}

export type TelemetryExporter = (observation: TelemetryObservation) => Promise<void> | void;

let exporter: TelemetryExporter | null = null;
let exporterFailureLogged = false;

export function registerTelemetryExporter(nextExporter: TelemetryExporter | null): void {
  exporter = nextExporter;
  exporterFailureLogged = false;
}

export async function recordTelemetry(observation: TelemetryObservation): Promise<void> {
  if (!exporter) return;
  try {
    await exporter({
      ...observation,
      name: observation.name.replace(/[^a-z0-9_.-]/gi, "_").slice(0, 120),
      attributes: Object.fromEntries(
        Object.entries(observation.attributes ?? {}).filter(([key]) => !/(email|phone|address|token|secret|reference|location)/i.test(key))
      ),
    });
  } catch {
    if (!exporterFailureLogged) {
      exporterFailureLogged = true;
      logApplicationEvent({
        level: "WARN",
        event: "telemetry.export_failed",
        message: "Telemetry export failed; business processing continues.",
        outcome: "UNAVAILABLE",
        errorCategory: "TELEMETRY_EXPORT_FAILURE",
      });
    }
  }
}
