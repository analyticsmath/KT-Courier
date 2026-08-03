import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const pages = fs.readdirSync(path.join(root, "app"), { recursive: true }).filter((entry) => String(entry).match(/(careers|applicant|recruitment).*page\.tsx$/));

describe("Phase 26 component surface audit", () => {
  it("ships non-empty public careers, applicant portal, and admin recruitment page surfaces", () => {
    expect(pages.length).toBeGreaterThanOrEqual(41);
    for (const page of pages) {
      const content = fs.readFileSync(path.join(root, "app", String(page)), "utf8");
      expect(content.trim().length, String(page)).toBeGreaterThan(100);
    }
  });

  it("states the public no-fee and accessibility commitments without static sample openings", () => {
    const careers = fs.readFileSync(path.join(root, "app/(public)/careers/page.tsx"), "utf8");
    expect(careers).toMatch(/never charges applicants|No application or screening fees/i);
    expect(careers).toMatch(/accommodation|accessib/i);
    expect(careers).not.toMatch(/Sample Opening|Example Applicant/);
  });
});
