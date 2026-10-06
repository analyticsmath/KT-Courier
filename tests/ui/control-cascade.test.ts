import { readFileSync } from "node:fs";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

describe("shared control cascade", () => {
  it("keeps generic control resets below component and utility styles", () => {
    const css = postcss.parse(readFileSync("app/globals.css", "utf8"));
    const unlayeredResets: string[] = [];
    css.walkRules((rule) => {
      if (!rule.selectors.some((selector) => /^(a|button|ul\[class\]|ol\[class\]|:focus-visible)$/.test(selector))) return;
      let parent: postcss.Node | undefined = rule.parent;
      while (parent && !(parent instanceof postcss.AtRule && parent.name === "layer")) parent = parent.parent;
      if (!parent) unlayeredResets.push(rule.selector);
    });
    // Unlayered resets override even high-specificity dashboard styles in layers.
    expect(unlayeredResets).toEqual([]);
  });
});
