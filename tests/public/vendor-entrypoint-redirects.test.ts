import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("vendor entry-point redirects", () => {
  it("directs obsolete vendor links to the role-protected store dashboard", async () => {
    const redirects = await nextConfig.redirects?.();
    expect(redirects).toEqual(
      expect.arrayContaining([
        { source: "/vendor", destination: "/store", permanent: false },
        { source: "/vendor/login", destination: "/store", permanent: false },
      ]),
    );
  });

  it("preserves the existing canonical admin and developer aliases", async () => {
    const redirects = await nextConfig.redirects?.();
    expect(redirects).toEqual(
      expect.arrayContaining([
        { source: "/admin/delivery-regions", destination: "/admin/regions", permanent: true },
        { source: "/developer", destination: "/developers", permanent: true },
      ]),
    );
  });
});
