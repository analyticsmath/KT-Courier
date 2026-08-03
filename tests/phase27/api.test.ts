import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const api = (...parts: string[]) => join(root, "app", "api", ...parts);

describe("Phase 27 API surface", () => {
  it("contains canonical user inbox operations", () => {
    for (const path of [["notifications", "route.ts"], ["notifications", "unread-count", "route.ts"], ["notifications", "[reference]", "route.ts"], ["notifications", "[reference]", "read", "route.ts"], ["notifications", "[reference]", "unread", "route.ts"], ["notifications", "[reference]", "archive", "route.ts"]]) expect(existsSync(api(...path))).toBe(true);
  });

  it("contains every required template and route lifecycle endpoint", () => {
    for (const path of [["admin", "notifications", "templates", "route.ts"], ["admin", "notifications", "templates", "[reference]", "versions", "route.ts"], ["admin", "notifications", "template-versions", "[reference]", "publish", "route.ts"], ["admin", "notifications", "routes", "route.ts"], ["admin", "notifications", "routes", "[reference]", "versions", "route.ts"], ["admin", "notifications", "route-versions", "[reference]", "activate", "route.ts"]]) expect(existsSync(api(...path))).toBe(true);
  });

  it("uses exact permission and same-origin administration guards", () => {
    const source = readFileSync(api("admin", "notifications", "templates", "route.ts"), "utf8");
    expect(source).toContain("NOTIFICATION_TEMPLATE_MANAGE");
    expect(readFileSync(join(root, "lib", "notifications", "admin-api.ts"), "utf8")).toContain("enforceSameOriginRequest");
  });
});
