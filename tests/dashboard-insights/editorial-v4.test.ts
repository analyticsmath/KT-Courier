import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("KT operations studio v4 structure", () => {
  it("has one brand in desktop navigation, not two duplicated logos", () => {
    const topbar = read("components/protected-v2/shell/EditorialTopbar.tsx");
    const navigation = read("components/protected-v2/navigation/ProtectedNavigation.tsx");
    expect(navigation).toContain("/media/public/illustrations/logo.svg");
    expect(topbar).not.toContain("/media/public/illustrations/logo.svg");
    expect(topbar).toContain("eo-topbar__workspace");
  });
  it("replaces the four compulsory metric cards with a composed operational cover", () => {
    const overview = read("components/protected-v2/admin/AdminCommandCentre.tsx");
    expect(overview).toContain("studio.cover");
    expect(overview).toContain("/media/dashboard/delivery-truck.webp");
    expect(overview).toContain("studio.coverSignals");
    expect(overview).not.toContain('label="Courier order volume"');
  });
  it("makes driver readiness a readable ordered evidence list instead of eight cramped cards", () => {
    const driver = read("components/admin/DriverDetailsConsole.tsx");
    expect(driver).toContain("kt-driver-readiness__list");
    expect(driver).not.toContain("lg:grid-cols-4 gap-2.5");
    expect(driver).toContain("kt-driver-blockers");
    expect(driver).toContain("kt-driver-console");
  });
  it("does not display bare machine identifiers as the driver's heading", () => {
    const page = read("app/(admin)/admin/drivers/[id]/page.tsx");
    expect(page).toContain('title={driver.displayName ?? driver.driverCode}');
    expect(page).toContain('className="kt-driver-detail-page"');
  });
  it("gives merchants and customers distinct task-oriented overviews", () => {
    const store = read("components/protected-v2/store/StoreOverviewPage.tsx");
    const customer = read("components/protected-v2/customer/CustomerDashboardHome.tsx");
    expect(store).toContain("role.merchantCover");
    expect(store).toContain("role.merchantSignals");
    expect(customer).toContain("role.customerCover");
    expect(customer).toContain("role.customerSignals");
    expect(store).not.toContain('label="Needs preparation"');
    expect(customer).not.toContain('label="Active deliveries"');
  });

  it("keeps illustrations purposefully loaded and uses static WebP assets", () => {
    const overview = read("components/protected-v2/admin/AdminCommandCentre.tsx");
    expect(overview).toContain('alt="Courier handing over a parcel"');
    expect(overview).toContain('loading="eager"');
    const css = read("components/protected-v2/admin/adminStudio.module.css");
    expect(css).toContain("prefers-reduced-motion");
  });
});
