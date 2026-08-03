import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDeveloperPortalRoute, selectDeveloperOperationalState } from "@/lib/developer-presentation";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("R18 developer portal boundary and presentation contracts", () => {
  it("keeps the public developer entry separate from the authenticated required catch-all", () => {
    const publicPage = source("app/(account)/developers/page.tsx");
    const portalLayout = source("app/(account)/developers/[...segments]/layout.tsx");
    const portalPage = source("app/(account)/developers/[...segments]/page.tsx");
    expect(publicPage).toContain("PublicVisualRoot");
    expect(publicPage).not.toContain("EditorialOperationsShell");
    expect(portalLayout).toContain("EditorialOperationsShell");
    expect(portalLayout).toContain('context="DEVELOPER"');
    expect(portalLayout).toContain("requireAuth");
    expect(portalPage).toContain("getDeveloperPresentationSnapshot");
    expect(portalPage).toContain("resolveDeveloperPortalRoute");
  });

  it("uses only verified developer path families and never treats the public root as protected navigation", () => {
    expect(resolveDeveloperPortalRoute(["applications"]).kind).toBe("applications");
    expect(resolveDeveloperPortalRoute(["applications", "dapp_example", "credentials"]).kind).toBe("application-credentials");
    expect(resolveDeveloperPortalRoute(["webhooks", "dwh_example", "deliveries"]).kind).toBe("webhook-deliveries");
    expect(resolveDeveloperPortalRoute(["webhook-deliveries", "dwhd_example"]).kind).toBe("delivery-detail");
    expect(resolveDeveloperPortalRoute(["invented", "route"]).kind).toBe("not-found");
    const registry = source("lib/protected-navigation/protected-navigation-registry.ts");
    expect(registry).not.toContain('id: "developer-overview"');
  });

  it("does not invent a healthy outcome for unknown or restricted operational state", () => {
    expect(selectDeveloperOperationalState({ applicationStatuses: ["UNKNOWN"], hasTermsAcceptance: true, credentialStatuses: [], deliveryStatuses: [], hasQuotaUsage: false }).kind).toBe("unavailable");
    expect(selectDeveloperOperationalState({ applicationStatuses: ["SUSPENDED", "ACTIVE"], hasTermsAcceptance: true, credentialStatuses: ["ACTIVE"], deliveryStatuses: [], hasQuotaUsage: false }).kind).toBe("restricted");
    expect(selectDeveloperOperationalState({ applicationStatuses: [], hasTermsAcceptance: false, credentialStatuses: [], deliveryStatuses: [], hasQuotaUsage: false }).kind).toBe("empty");
  });

  it("keeps browser secret handling transient and presentation queries free of secret-bearing fields", () => {
    const actions = source("components/protected-v2/developer/DeveloperPortalActions.tsx");
    const data = source("lib/developer-presentation/developer-data.ts");
    expect(actions).toContain("navigator.clipboard.writeText");
    expect(actions).not.toContain("localStorage");
    expect(actions).not.toContain("sessionStorage");
    expect(actions).not.toContain("console.");
    expect(data).not.toContain("credentialHash");
    expect(data).not.toContain("encryptedSecret");
    expect(data).not.toContain("encryptedEndpoint");
    expect(data).not.toContain("responseBody");
    expect(source("components/protected-v2/developer/DeveloperPages.tsx")).toContain("attempt.deliveryReference === delivery.reference");
  });
});
