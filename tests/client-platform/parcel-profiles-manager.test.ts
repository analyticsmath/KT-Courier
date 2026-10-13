import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ParcelProfilesManager } from "@/components/admin/ParcelProfilesManager";

describe("parcel-profile operations configuration", () => {
  it("lets an authorized administrator prepare each missing canonical size", () => {
    const markup = renderToStaticMarkup(createElement(ParcelProfilesManager, { initial: [], canManage: true, nowIso: "2026-10-13T20:00:00.000Z" }));
    for (const name of ["Small", "Medium", "Large"]) {
      expect(markup).toContain(`Prepare ${name} profile`);
    }
    expect(markup).toContain("not approved operating limits");
    expect(markup).not.toContain('value="ACTIVE" selected');
  });

  it("does not expose creation controls without commercial manage permission", () => {
    const markup = renderToStaticMarkup(createElement(ParcelProfilesManager, { initial: [], canManage: false, nowIso: "2026-10-13T20:00:00.000Z" }));
    expect(markup).toContain("Ask an administrator");
    expect(markup).not.toContain("Prepare Small profile");
    expect(markup).not.toContain("Prepare Medium profile");
    expect(markup).not.toContain("Prepare Large profile");
  });

  it("does not duplicate already-defined size creation actions", () => {
    const markup = renderToStaticMarkup(createElement(ParcelProfilesManager, {
      initial: [{
        id: "profile-small-draft",
        stableKey: "SMALL",
        versionNumber: 1,
        displayName: "Small",
        lengthCm: 30,
        widthCm: 20,
        heightCm: 10,
        maximumWeightKg: 5,
        status: "DRAFT",
        effectiveFrom: "2026-10-13T10:00:00.000Z",
        effectiveTo: null,
      }],
      canManage: true, nowIso: "2026-10-13T20:00:00.000Z",
    }));
    expect(markup).not.toContain("Prepare Small profile");
    expect(markup).toContain("Prepare Medium profile");
    expect(markup).toContain("Prepare Large profile");
    expect(markup).toContain("Prepare new version");
    expect(markup).toContain("DRAFT");
  });
});
