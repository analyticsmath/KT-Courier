"use client";

import { Select } from "@/components/ui/Select";
import { categorySelection, type CategoryChoice } from "@/lib/catalog/category-selection";

export function CategoryCascade({ categories, value, onChange }: { categories: CategoryChoice[]; value: string; onChange: (id: string) => void }) {
  const selection = categorySelection(categories, value);
  return <fieldset className="space-y-3">
    <legend className="font-semibold">Product category</legend>
    <p className="text-sm text-[var(--kt-text-muted)]">Start with a category, then choose the subcategory that best describes your product.</p>
    {!selection.levels[0].options.length ? <p role="status">No categories are currently available. Contact KT Couriers before adding this product.</p> : null}
    {selection.levels.map((level, index) => {
      const label = index === 0 ? "Category" : index === 1 ? "Subcategory" : `Subcategory level ${index}`;
      const id = index === 0 ? "category" : `category-level-${index}`;
      return <div key={level.parentId ?? "root"}>
        <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
        <Select id={id} value={level.selectedId} placeholder={index === 0 ? "Select a category" : undefined}
          onChange={event => onChange(event.target.value || level.parentId || "")}
          options={[
            ...(index ? [{ value: "", label: "Select a subcategory (optional)" }] : []),
            ...level.options.map(category => ({ value: category.id, label: category.name })),
          ]} />
      </div>;
    })}
    {!selection.valid ? <p role="alert" className="text-sm">Your saved category is no longer available. Choose a category again.</p> : null}
    {selection.path.length ? <p className="text-sm" aria-live="polite">Selected category: {selection.path.map(category => category.name).join(" / ")}</p> : null}
  </fieldset>;
}
