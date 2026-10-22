import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { getProfileAvatarUrl } from "@/lib/client-platform/profile-avatar-url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getVisiblePaginationItems, ProtectedPagination } from "@/components/protected-v2/data/FilterAndPagination";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";

const source = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("KT premium protected dashboards", () => {
  it("limits long pagination lists while retaining first, last and current pages", () => {
    expect(getVisiblePaginationItems(50, 100)).toEqual([1, "ellipsis", 49, 50, 51, "ellipsis", 100]);
    expect(getVisiblePaginationItems(1, 100)).toEqual([1, 2, "ellipsis", 100]);
    expect(getVisiblePaginationItems(100, 100)).toEqual([1, "ellipsis", 99, 100]);
    expect(getVisiblePaginationItems(2, 3)).toEqual([1, 2, 3]);
  });

  it("renders accessible pagination without overflowing with 100 links", () => {
    const html = renderToStaticMarkup(React.createElement(ProtectedPagination, {currentPage: 50, pageCount: 100, hrefForPage: (page) => `/admin/stores?page=${page}`}));
    expect(html.match(/href=/g)).toHaveLength(7);
    expect(html).toContain("Page 50 of 100");
    expect(html).toContain('aria-current="page"');
  });

  it("makes operational statuses legible without a colored background badge", () => {
    const html = renderToStaticMarkup(React.createElement(ProtectedStatus, {label: "Pending approval", tone: "warning"}));
    expect(html).toContain("Pending approval");
    const premium = source("app/protected-premium.css");
    expect(premium).toContain("KT PREMIUM PROTECTED WORKSPACE V3");
    expect(premium).toContain(".eo-status--warning");
    expect(premium).toContain("background: transparent");
    expect(premium).toContain("animation: none !important");
  });

  it("propagates uploaded profile images to dashboard navigation and topbar", () => {
    expect(source("components/protected-v2/shell/EditorialTopbar.tsx")).toContain("user.avatarUrl");
    expect(source("components/protected-v2/navigation/ProtectedNavigation.tsx")).toContain("user.avatarUrl");
    expect(source("app/(admin)/admin/layout.tsx")).toContain("avatarMediaReference");
  });

  it("updates image URLs on upload without leaking private media identifiers", () => {
    expect(getProfileAvatarUrl(null)).toBeUndefined();
    const oldUrl = getProfileAvatarUrl("private-asset-A");
    const newUrl = getProfileAvatarUrl("private-asset-B");
    expect(oldUrl).not.toEqual(newUrl);
    expect(newUrl).toMatch(/^\/api\/platform\/avatar\?v=[a-f0-9]{12}$/);
    expect(newUrl).not.toContain("private-asset-B");
  });

  it("keeps merchant filters scoped to the protected system", () => {
    expect(source("app/(admin)/admin/stores/page.tsx")).toContain("eo-filter-chips");
  });
});
