import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("marketing and cookie preference authority", () => {
  it("keeps purpose-specific marketing enforcement in the canonical notification policy", () => {
    const contracts = read("lib/notifications/contracts.ts"); const authority = read("lib/notifications/authority.ts"); const service = read("lib/privacy/preference.service.ts");
    expect(contracts).toMatch(/purpose === "MARKETING" && input\.consent === "REVOKED"[\s\S]*USER_OPTED_OUT/);
    expect(contracts).toMatch(/purpose === "MARKETING" && input\.consent !== "GRANTED"/);
    expect(authority).toMatch(/NotificationPreferenceService/);
    expect(service).toMatch(/MARKETING_CHANNELS/);
    expect(service).toMatch(/MARKETING_OPT_OUT/);
  });
  it("models cookie current state and append-only versioned evidence separately from legal acceptance", () => {
    const schema = read("prisma/schema.prisma"); const migration = read("prisma/migrations/20260811178000_phase_b_privacy_preference_authority/migration.sql"); const service = read("lib/privacy/preference.service.ts");
    expect(schema).toMatch(/model CookiePreference[\s\S]*necessary[\s\S]*functional[\s\S]*analytics[\s\S]*marketing/);
    expect(schema).toMatch(/model CookiePreferenceEvent[\s\S]*operationId[\s\S]*stateSnapshot/);
    expect(migration).toMatch(/CookiePreferenceEvent/);
    expect(service).toMatch(/COOKIE_SCHEMA_VERSION/);
    expect(service).toMatch(/cookiePreferenceEvent\.create/);
    expect(service).not.toMatch(/acceptTerms\(/);
  });
  it("exposes self-only, privacy-safe preference APIs with protected anonymous cookie mutation", () => {
    const marketing = read("app/api/privacy/marketing-preferences/route.ts"); const cookie = read("app/api/privacy/cookie-preferences/route.ts"); const rateLimit = read("lib/security/rate-limit.ts");
    expect(marketing).toMatch(/getCurrentUser/); expect(marketing).toMatch(/setMarketingPreference\(\{ userId: user\.id/);
    expect(cookie).toMatch(/hashAnonymousCookieSubject/); expect(cookie).toMatch(/httpOnly: true/);
    expect(cookie).toMatch(/COOKIE_PREFERENCE_MUTATION/); expect(rateLimit).toMatch(/COOKIE_PREFERENCE_MUTATION/);
  });
});
