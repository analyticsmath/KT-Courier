import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
function routes(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? routes(join(directory, entry.name)) : entry.name === "route.ts" ? [join(directory, entry.name)] : []);
}
const text = (path: string) => readFileSync(path, "utf8");

describe("Phase 27 authenticated API contract audit", () => {
  it("puts every user notification route behind exact self-service access, origin, and rate-limit policy", () => {
    const files = routes(join(root, "app", "api", "notifications"));
    expect(files).toHaveLength(14);
    for (const file of files) {
      const source = text(file); const path = relative(root, file).replaceAll("\\", "/");
      if (path.includes("/unsubscribe/")) expect(source).toContain("verifyMarketingUnsubscribe");
      else expect(source).toContain("requireNotificationUser");
      if (/export async function (POST|PATCH|DELETE)/.test(source) && !path.includes("/unsubscribe/")) expect(source).toContain("requireNotificationUser(request, true");
    }
    const policy = text(join(root, "lib", "notifications", "api-policy.ts"));
    expect(policy).toContain("checkIpRateLimit"); expect(policy).toContain("Same-origin request required."); expect(policy).toContain("hasPermission");
  });

  it("enforces preference, consent, endpoint, and unsubscribe privacy contracts at their API boundaries", () => {
    const preferences = text(join(root, "app", "api", "notifications", "preferences", "route.ts"));
    const endpoints = text(join(root, "app", "api", "notifications", "endpoints", "route.ts"));
    const revoke = text(join(root, "app", "api", "notifications", "consents", "marketing", "revoke", "route.ts"));
    const unsubscribe = text(join(root, "app", "api", "notifications", "unsubscribe", "[token]", "route.ts"));
    expect(preferences).toContain('z.enum(["ENABLED", "DISABLED"])'); expect(preferences).toContain("Mandatory notifications cannot be disabled."); expect(preferences).toContain("isValidNotificationTimezone"); expect(preferences).toContain("Quiet hours require both");
    expect(endpoints).toContain("encryptNotificationEndpoint"); expect(endpoints).toContain("isValidNotificationTimezone"); expect(endpoints).not.toContain("endpoint: item.endpoint");
    expect(revoke).toContain("suppressionReference"); expect(revoke).toContain("replay: true");
    expect(unsubscribe).toContain("verifyMarketingUnsubscribe"); expect(unsubscribe).not.toContain("redirect(");
  });
});

describe("Phase 27 admin and shared-component contract audit", () => {
  it("puts every admin notification route behind an exact permission, same-origin, rate-limit, and canonical service boundary", () => {
    const files = routes(join(root, "app", "api", "admin", "notifications"));
    expect(files).toHaveLength(23);
    for (const file of files) {
      const source = text(file);
      expect(source).toContain("notificationAdminAccess");
      expect(source).toContain("PERMISSIONS.NOTIFICATION_");
    }
    const policy = text(join(root, "lib", "notifications", "admin-api.ts"));
    expect(policy).toContain("enforceSameOriginRequest"); expect(policy).toContain("checkIpRateLimit"); expect(policy).toContain("resolveNotificationProductionComposition");
    expect(files.map(text).join("\n")).not.toMatch(/manual.*send|send.*manual|status:\s*["']DELIVERED["']/i);
  });

  it("uses the shared centre and source-backed operations surfaces across all six product roles", () => {
    const centre = text(join(root, "components", "notifications", "NotificationCentre.tsx"));
    const admin = text(join(root, "components", "notifications", "AdminNotificationSurface.tsx"));
    expect(centre).toContain("aria-label=\"Notification centre\""); expect(centre).toContain("You have no notifications."); expect(centre).toContain("Unread notification"); expect(centre).toContain("aria-label={`${count} unread notifications`}");
    expect(admin).toContain("findMany"); expect(admin).toContain("No {labels[kind].toLowerCase()} records."); expect(admin).toContain("LOCKED"); expect(admin).toContain("retry scheduled, suppressed and reconciliation states");
    for (const page of ["app/(account)/account/notifications/page.tsx", "app/(store)/store/notifications/page.tsx", "app/(driver)/driver/notifications/page.tsx", "app/(account)/promoter/notifications/page.tsx", "app/(applicant)/applicant/notifications/page.tsx"]) expect(text(join(root, page))).toContain("NotificationCentre");
  });
});
