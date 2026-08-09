import crypto from "node:crypto";

export type ApplicationLogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";
export type LogOutcome = "SUCCESS" | "FAILURE" | "DENIED" | "RETRY" | "UNAVAILABLE";

export interface ApplicationLogEvent {
  level: ApplicationLogLevel;
  event: string;
  message: string;
  requestId?: string;
  traceId?: string;
  route?: string;
  operation?: string;
  actorType?: string;
  actorReference?: string;
  resourceReference?: string;
  outcome?: LogOutcome;
  durationMs?: number;
  errorCategory?: string;
  context?: Record<string, unknown>;
}

export interface SafeApplicationLogEvent extends Omit<ApplicationLogEvent, "message" | "context"> {
  timestamp: string;
  message: string;
  context?: Record<string, unknown>;
}

const SENSITIVE_KEY = /(?:pass(?:word|phrase)?|secret|token|authorization|cookie|api[-_]?key|credential|private[-_]?key|database[_-]?url|otp|challenge|card|cvv|proof.*(?:url|path)|location|address)/i;
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]+/g;
const MAX_STRING_LENGTH = 512;
const MAX_CONTEXT_KEYS = 32;
const MAX_CONTEXT_DEPTH = 3;

function normalizeText(value: unknown, maximum = MAX_STRING_LENGTH): string {
  return String(value ?? "")
    .replace(CONTROL_CHARACTERS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function redact(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth >= MAX_CONTEXT_DEPTH) return "[TRUNCATED]";
  if (typeof value === "string") return normalizeText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 20).map((entry) => redact(entry, depth + 1));
  if (typeof value !== "object") return "[UNSUPPORTED]";

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, MAX_CONTEXT_KEYS)
      .map(([key, entry]) => [normalizeText(key, 80), SENSITIVE_KEY.test(key) ? "[REDACTED]" : redact(entry, depth + 1)])
  );
}

export function safeLogReference(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function sanitizeLogContext(value: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined;
  return redact(value) as Record<string, unknown>;
}

export function toSafeApplicationLogEvent(event: ApplicationLogEvent): SafeApplicationLogEvent {
  return {
    ...event,
    timestamp: new Date().toISOString(),
    event: normalizeText(event.event, 120),
    message: normalizeText(event.message),
    route: event.route ? normalizeText(event.route, 256) : undefined,
    operation: event.operation ? normalizeText(event.operation, 120) : undefined,
    actorType: event.actorType ? normalizeText(event.actorType, 80) : undefined,
    actorReference: event.actorReference ? safeLogReference(event.actorReference) : undefined,
    resourceReference: event.resourceReference ? safeLogReference(event.resourceReference) : undefined,
    errorCategory: event.errorCategory ? normalizeText(event.errorCategory, 120) : undefined,
    durationMs: event.durationMs === undefined ? undefined : Math.max(0, Math.round(event.durationMs)),
    context: sanitizeLogContext(event.context),
  };
}

export function logApplicationEvent(event: ApplicationLogEvent): void {
  const safeEvent = toSafeApplicationLogEvent(event);
  const line = JSON.stringify(safeEvent);
  if (safeEvent.level === "ERROR") console.error(line);
  else if (safeEvent.level === "WARN") console.warn(line);
  else console.info(line);
}
