import { NotificationPolicyError, type NotificationChannel, type NotificationSensitivity, assertNotificationContent } from "./contracts";

export type TemplateVariable = { name: string; type: "TEXT" | "REFERENCE" | "DATE" | "DATETIME" | "CURRENCY" | "INTEGER" | "BOOLEAN" | "SAFE_INTERNAL_URL"; required: boolean; maximumLength: number; sensitivity: NotificationSensitivity; allowedChannels: NotificationChannel[]; };
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");

function validValue(variable: TemplateVariable, value: unknown): string {
  if (value === undefined || value === null) { if (variable.required) throw new NotificationPolicyError("TEMPLATE_REQUIRED_VARIABLE_MISSING"); return ""; }
  if (!["TEXT", "REFERENCE", "DATE", "DATETIME", "CURRENCY", "INTEGER", "BOOLEAN", "SAFE_INTERNAL_URL"].includes(variable.type)) throw new NotificationPolicyError("UNSAFE_NOTIFICATION_CONTENT");
  if (variable.type === "BOOLEAN") {
    if (typeof value !== "boolean") throw new NotificationPolicyError("UNSAFE_NOTIFICATION_CONTENT");
    return String(value);
  }
  if (variable.type === "INTEGER") {
    if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new NotificationPolicyError("UNSAFE_NOTIFICATION_CONTENT");
    return String(value);
  }
  if (variable.type === "CURRENCY") {
    if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 1_000_000_000) throw new NotificationPolicyError("UNSAFE_NOTIFICATION_CONTENT");
    return value.toFixed(2);
  }
  if (["TEXT", "REFERENCE", "SAFE_INTERNAL_URL"].includes(variable.type) && typeof value !== "string") throw new NotificationPolicyError("UNSAFE_NOTIFICATION_CONTENT");
  const text = String(value);
  if (variable.type === "DATE") {
    const parsed = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(text);
    const date = parsed ? new Date(`${text}T00:00:00.000Z`) : null;
    if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) throw new NotificationPolicyError("UNSAFE_NOTIFICATION_CONTENT");
  }
  if (variable.type === "DATETIME" && (Number.isNaN(Date.parse(text)) || !/[TZ]|[+-]\d\d:\d\d$/.test(text))) throw new NotificationPolicyError("UNSAFE_NOTIFICATION_CONTENT");
  if (text.length > variable.maximumLength || (variable.type === "SAFE_INTERNAL_URL" && !/^\/(?!\/)[A-Za-z0-9/_?=&%.-]+$/.test(text))) throw new NotificationPolicyError("UNSAFE_NOTIFICATION_CONTENT");
  return text;
}

/** Strict {{variable}} interpolation: no expressions, no unknown or implicit variables. */
export function renderNotificationTemplate(input: { template: string; variables: TemplateVariable[]; values: Record<string, unknown>; channel: NotificationChannel; sensitivity: NotificationSensitivity; html?: boolean; actionRoute?: string }): string {
  const definition = new Map(input.variables.map((variable) => [variable.name, variable]));
  for (const key of Object.keys(input.values)) if (!definition.has(key)) throw new NotificationPolicyError("UNSAFE_NOTIFICATION_CONTENT");
  const output = input.template.replace(/{{\s*([A-Za-z][A-Za-z0-9_]*)\s*}}/g, (_token, name: string) => {
    const variable = definition.get(name);
    if (!variable || !variable.allowedChannels.includes(input.channel)) throw new NotificationPolicyError("UNSAFE_NOTIFICATION_CONTENT");
    if (variable.sensitivity === "RESTRICTED" && input.channel !== "IN_APP") throw new NotificationPolicyError("UNSAFE_NOTIFICATION_CONTENT");
    const value = validValue(variable, input.values[name]);
    return input.html ? escapeHtml(value) : value;
  });
  if (/{{|}}/.test(output)) throw new NotificationPolicyError("UNSAFE_NOTIFICATION_CONTENT");
  assertNotificationContent({ sensitivity: input.sensitivity, channel: input.channel, body: output, actionRoute: input.actionRoute });
  return output;
}
