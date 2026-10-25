import { describe, it, expect } from "vitest";
import { parseManagedCatalogCsv } from "@/lib/super-admin/bulk-catalog";

describe("Super Admin bulk catalog staging", () => {
  it("parses quoted commas and escaped quotes without publishing any item", () => {
    expect(parseManagedCatalogCsv('title,shortDescription\n"Fresh, red apples","Grown ""locally"""\nBananas,Ripe bananas')).toEqual([
      { title: "Fresh, red apples", shortDescription: 'Grown "locally"' },
      { title: "Bananas", shortDescription: "Ripe bananas" },
    ]);
  });
  it("rejects formula cells and remote URLs before any database writes", () => {
    expect(() => parseManagedCatalogCsv('title,shortDescription\n=HYPERLINK("https://bad") ,Apples')).toThrow();
    expect(() => parseManagedCatalogCsv('title,shortDescription\nApples,https://elsewhere.com/x')).toThrow();
  });
  it("rejects unknown columns, duplicate headings and excessive rows", () => {
    expect(() => parseManagedCatalogCsv('title,price\nApples,4')).toThrow();
    expect(() => parseManagedCatalogCsv('title,title\nApples,Apples')).toThrow();
    expect(() => parseManagedCatalogCsv('title\n' + Array(101).fill('Apples').join('\n'))).toThrow();
  });
  it("rejects unterminated quotes and line mismatches", () => {
    expect(() => parseManagedCatalogCsv('title,shortDescription\n"Apples,yes')).toThrow();
    expect(() => parseManagedCatalogCsv('title,shortDescription\nApples')).toThrow();
  });
});
