import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const roots = ["app", "lib", "scripts", "tests", "docs"];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".md"]);
const rules = [
  ["resend_import", /\bfrom\s*["']resend["']/gi],
  ["smtp_transport", /\b(?:nodemailer|createTransport|SMTPTransport)\b/gi],
  ["ses_client", /@aws-sdk\/client-ses|\bSESClient\b/gi],
  ["direct_email_provider", /\b(?:resend\.emails|sendMail|sendEmail)\b/gi],
  ["direct_sms_client", /\b(?:twilio|sendSms|sendSMS)\b/gi],
  ["direct_fcm", /\b(?:firebase-admin|FCMClient|messaging\(\)\.send)\b/gi],
  ["direct_web_push", /\b(?:web-push|webpush)\b/gi],
  ["console_delivery", /console\.(?:log|info|warn|error)\([^\n]*(?:(?:sending|sent|delivered).{0,80}(?:email|sms|push)|(?:email|sms|push).{0,80}(?:send|deliver))/gi],
  ["authentication_email_callback", /\b(?:sendVerificationRequest|sendPasswordResetEmail)\b/gi],
  ["route_handler_delivery", /\b(?:provider\.send|\.deliver\()\b/gi],
  ["legacy_notification_database", /\b(?:prisma|db)\.(?:notification|emailLog|smsLog|pushSubscription)\b/gi],
  ["security_intent_producer", /\b(?:queueSecurityNotification|generateAndSendDeliveryOtp)\b/gi],
];

function collect(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collect(path);
    return sourceExtensions.has(entry.name.slice(entry.name.lastIndexOf("."))) && entry.name !== "audit-phase27-notification-authority.mjs" ? [path] : [];
  });
}

function classification(path, line) {
  const normalized = path.replaceAll("\\", "/");
  if (normalized.startsWith("tests/")) return "TEST_ONLY";
  if (normalized.startsWith("docs/")) return "DOCUMENTATION_ONLY";
  if (normalized === "lib/notifications/security-delivery.ts" || /(?:queueSecurityNotification|generateAndSendDeliveryOtp)/.test(line) && (normalized.startsWith("app/api/auth/") || normalized === "lib/services/delivery-otp.service.ts" || normalized.startsWith("app/api/driver/assignments/"))) return "SECURITY_EVENT_PRODUCER";
  if (normalized.startsWith("lib/notifications/") || normalized === "lib/email/email-service.ts" || normalized.startsWith("app/api/notifications/") || normalized.startsWith("app/api/admin/notifications/") || normalized.startsWith("scripts/") || normalized.startsWith("lib/developer-api/")) return "CANONICAL_PHASE27";
  return "FORBIDDEN_PRODUCTION_SENDER";
}

const matches = [];
for (const directory of roots) for (const file of collect(join(root, directory))) {
  const path = relative(root, file).replaceAll("\\", "/");
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  for (const [rule, expression] of rules) for (const [index, line] of lines.entries()) {
    expression.lastIndex = 0;
    if (expression.test(line)) matches.push({ rule, path, line: index + 1, classification: classification(path, line), excerpt: line.trim().slice(0, 180) });
  }
}

const summary = Object.fromEntries(["CANONICAL_PHASE27", "SECURITY_EVENT_PRODUCER", "TEST_ONLY", "DOCUMENTATION_ONLY", "FORBIDDEN_PRODUCTION_SENDER"].map((kind) => [kind, matches.filter((item) => item.classification === kind).length]));
const report = { audit: "phase27-notification-authority", productionDeliveryAuthority: { email: "Phase 27 canonical notification authority", sms: "Phase 27 canonical notification authority", push: "Phase 27 canonical notification authority" }, summary, matches };
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (summary.FORBIDDEN_PRODUCTION_SENDER) process.exitCode = 1;
