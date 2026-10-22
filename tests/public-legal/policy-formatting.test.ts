import { describe, expect, it } from "vitest";
import { parsePublishedPolicy } from "@/lib/public-legal/policy-formatting";

describe("published policy presentation", () => {
  it("groups published sections and preserves their substantive wording", () => {
    const sections = parsePublishedPolicy("Original introduction.\n1. YOUR RIGHTS\nApplicable law prevails.\n1.1 Important detail\nContact the team.");
    expect(sections.map((section) => section.title)).toEqual(["Overview", "YOUR RIGHTS"]);
    expect(sections[1].blocks).toEqual([
      { kind: "paragraph", text: "Applicable law prevails." },
      { kind: "subheading", text: "1.1 Important detail" },
      { kind: "paragraph", text: "Contact the team." },
    ]);
  });

  it("recognises source-document bullets as actual list items", () => {
    const sections = parsePublishedPolicy("1. DELIVERY\n• Collection address\n Recipient address\n- Contact number\nThe final paragraph.");
    expect(sections[0].blocks).toEqual([
      { kind: "list", items: ["Collection address", "Recipient address", "Contact number"] },
      { kind: "paragraph", text: "The final paragraph." },
    ]);
  });

  it("omits only internal edition labels, not legal effective dates or rights", () => {
    const sections = parsePublishedPolicy("Client version 1\nVersion 2016\nEffective Date: 9 August 2026\nNothing in this policy limits statutory remedies.");
    expect(sections[0].blocks).toEqual([
      { kind: "paragraph", text: "Effective Date: 9 August 2026" },
      { kind: "paragraph", text: "Nothing in this policy limits statutory remedies." },
    ]);
  });

  it("returns no invented policy text for an empty publication", () => {
    expect(parsePublishedPolicy(" \n \r\n ")).toEqual([]);
  });
});
