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
  marketplace: 225,
  fan: 115,
  preparation: 110,
  collection: 175,
  custody: 130,
  route: 180,
  freight: 160,
  arrival: 125,
  finale: 110,
};

export const HOME_MOBILE_CHAPTER_BUDGETS_VH: Record<HomeChapter, number> = {
  hero: 260,
  marketplace: 100,
  fan: 102,
  preparation: 105,
  collection: 165,
  custody: 130,
  route: 170,
  freight: 150,
  arrival: 128,
  finale: 112,
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
  const visibleCategoryCount = Math.min(5, Math.max(3, categoryCount));
  return Math.min(240, Math.max(215, 125 + visibleCategoryCount * 20));
}

export function chapterBudgetVh(chapter: HomeChapter, categoryCount = 5): number {
  return chapter === "marketplace"
    ? marketplaceBudgetVh(categoryCount)
    : HOME_CHAPTER_BUDGETS_VH[chapter];
}

export function mobileChapterBudgetVh(chapter: HomeChapter, categoryCount = 5): number {
  return HOME_MOBILE_CHAPTER_BUDGETS_VH[chapter] ?? chapterBudgetVh(chapter, categoryCount);
}
