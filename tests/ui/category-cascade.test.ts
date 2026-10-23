// @vitest-environment jsdom
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { CategoryCascade } from "@/components/catalog/CategoryCascade";
import { categorySelection, type CategoryChoice } from "@/lib/catalog/category-selection";

const categories: CategoryChoice[] = [
  { id: "groceries", name: "Groceries", path: "/groceries", parentId: null },
  { id: "fresh", name: "Fresh Produce", path: "/groceries/fresh", parentId: "groceries" },
  { id: "fruit", name: "Fruit", path: "/groceries/fresh/fruit", parentId: "fresh" },
  { id: "bakery", name: "Bakery", path: "/groceries/bakery", parentId: "groceries" },
  { id: "home", name: "Home", path: "/home", parentId: null },
  { id: "bedding", name: "Bedding", path: "/home/bedding", parentId: "home" },
];

it("shows one branch at a time and discards the previous branch when a parent changes", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let selected = "";
  function Form() {
    const [value, setValue] = useState("fruit");
    selected = value;
    return React.createElement(CategoryCascade, { categories, value, onChange: setValue });
  }
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(React.createElement(Form)));
    const selects = () => Array.from(host.querySelectorAll("select"));
    expect(selects().map(select => select.value)).toEqual(["groceries", "fresh", "fruit"]);
    expect(Array.from(selects()[0].options).map(option => option.text)).toEqual(["Select a category", "Groceries", "Home"]);
    expect(host.textContent).toContain("Groceries / Fresh Produce / Fruit");
    await act(async () => {
      selects()[0].value = "home";
      selects()[0].dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(selected).toBe("home");
    expect(selects().map(select => select.value)).toEqual(["home", ""]);
    expect(Array.from(selects()[1].options).map(option => option.text)).toEqual(["Select a subcategory (optional)", "Bedding"]);
    expect(host.textContent).not.toContain("Fruit");
    await act(async () => {
      selects()[1].value = "bedding";
      selects()[1].dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(selected).toBe("bedding"); expect(host.textContent).toContain("Home / Bedding");
  } finally {
    await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  }
});

it("does not promote orphaned or cyclic saved categories into selectable roots", () => {
  const invalid: CategoryChoice[] = [
    ...categories,
    { id: "orphan", name: "Orphan", path: "/missing/orphan", parentId: "missing" },
    { id: "cycle-a", name: "A", path: "/a", parentId: "cycle-b" },
    { id: "cycle-b", name: "B", path: "/b", parentId: "cycle-a" },
  ];
  for (const id of ["orphan", "cycle-a", "deleted"]) {
    const result = categorySelection(invalid, id);
    expect(result.valid).toBe(false); expect(result.path).toEqual([]);
    expect(result.levels[0].options.map(option => option.id)).toEqual(["groceries", "home"]);
  }
});
