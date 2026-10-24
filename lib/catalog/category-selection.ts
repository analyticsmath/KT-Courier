export type CategoryChoice = { id: string; name: string; path: string; parentId: string | null; displayOrder?: number; productTypeIds?: string[] };

/** Follow stored parent IDs; never promote a child whose parent is unavailable. */
export function categorySelection(categories: CategoryChoice[], selectedId: string) {
  const byId = new Map(categories.map(category => [category.id, category]));
  const path: CategoryChoice[] = [];
  const seen = new Set<string>();
  let current = byId.get(selectedId);
  let valid = !selectedId || Boolean(current);
  while (current) {
    if (seen.has(current.id)) { valid = false; break; }
    seen.add(current.id); path.unshift(current);
    if (!current.parentId) break;
    current = byId.get(current.parentId);
    if (!current) valid = false;
  }
  if (!valid) path.length = 0;
  const siblings = (parentId: string | null) => categories
    .filter(category => (category.parentId ?? null) === parentId)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name, "en-ZA"));
  const levels = [{ parentId: null as string | null, options: siblings(null), selectedId: path[0]?.id ?? "" }];
  for (let index = 0; index < path.length; index++) {
    const children = siblings(path[index].id);
    if (!children.length) break;
    levels.push({ parentId: path[index].id, options: children, selectedId: path[index + 1]?.id ?? "" });
  }
  return { levels, path, valid };
}

/** The nearest mapped ancestor defines the form; choose the latest approved revision per code. */
export function categoryProductType<T extends { id: string; code: string; versionNumber: number }>(categories: CategoryChoice[], selectedId: string, types: T[]): T | undefined {
  const selection = categorySelection(categories, selectedId);
  for (const category of [...selection.path].reverse()) {
    if (!category.productTypeIds?.length) continue;
    const choices = types.filter(type => category.productTypeIds!.includes(type.id));
    const codes = new Set(choices.map(type => type.code));
    if (codes.size !== 1) return undefined;
    return choices.sort((a, b) => b.versionNumber - a.versionNumber)[0];
  }
  return undefined;
}
