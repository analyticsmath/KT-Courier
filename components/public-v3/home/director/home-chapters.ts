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
  hero: 205,
  marketplace: 300,
  fan: 150,
  preparation: 125,
  collection: 205,
  custody: 170,
  route: 235,
  freight: 190,
  arrival: 150,
  finale: 145,
};

export const HOME_MOBILE_CHAPTER_BUDGETS_VH: Record<HomeChapter, number> = {
  hero: 260,
  marketplace: 150,
  fan: 120,
  preparation: 115,
  collection: 185,
  custody: 155,
  route: 210,
  freight: 175,
  arrival: 145,
  finale: 130,
};

export type HomeMobilePolicy = "document" | "native-snap" | "sticky";

export const HOME_MOBILE_POLICY: Record<HomeChapter, HomeMobilePolicy> = {
  hero: "document",
  marketplace: "native-snap",
  fan: "document",
  preparation: "document",
  collection: "sticky",
  custody: "sticky",
  route: "sticky",
  freight: "sticky",
  arrival: "sticky",
  finale: "document",
};

export function marketplaceBudgetVh(categoryCount: number): number {
  const visibleCategoryCount = Math.min(6, Math.max(3, categoryCount));
  return Math.min(340, 90 + visibleCategoryCount * 42);
}

export function chapterBudgetVh(chapter: HomeChapter, categoryCount = 5): number {
  return chapter === "marketplace"
    ? marketplaceBudgetVh(categoryCount)
    : HOME_CHAPTER_BUDGETS_VH[chapter];
}

export function mobileChapterBudgetVh(chapter: HomeChapter, categoryCount = 5): number {
  return HOME_MOBILE_CHAPTER_BUDGETS_VH[chapter] ?? chapterBudgetVh(chapter, categoryCount);
}
