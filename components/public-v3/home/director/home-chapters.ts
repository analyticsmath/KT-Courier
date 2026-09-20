export const HOME_CHAPTERS = [
  "hero",
  "marketplace",
  "fan",
  "preparation",
  "collection",
  "custody",
  "route",
  "freight",
  "arrival",
  "finale",
] as const;

export type HomeChapter = (typeof HOME_CHAPTERS)[number];

export const HOME_CHAPTER_BUDGETS_VH: Record<HomeChapter, number> = {
  hero: 200,
  marketplace: 355,
  fan: 155,
  preparation: 105,
  collection: 220,
  custody: 165,
  route: 260,
  freight: 210,
  arrival: 155,
  finale: 120,
};

export const HOME_MOBILE_POLICY: Record<HomeChapter, "document" | "native-snap"> = {
  hero: "document",
  marketplace: "native-snap",
  fan: "document",
  preparation: "document",
  collection: "document",
  custody: "document",
  route: "document",
  freight: "document",
  arrival: "document",
  finale: "document",
};

export function marketplaceBudgetVh(categoryCount: number): number {
  const visibleCategoryCount = Math.min(6, Math.max(3, categoryCount));
  return Math.min(410, 80 + visibleCategoryCount * 55);
}

export function chapterBudgetVh(chapter: HomeChapter, categoryCount = 5): number {
  return chapter === "marketplace"
    ? marketplaceBudgetVh(categoryCount)
    : HOME_CHAPTER_BUDGETS_VH[chapter];
}
