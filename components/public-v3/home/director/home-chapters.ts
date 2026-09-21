export const HOME_CHAPTERS = [
  "hero",
  "marketplace",
  "preparation",
  "journey",
  "freight",
  "finale",
] as const;

export type HomeChapter = (typeof HOME_CHAPTERS)[number];
export type PostHeroChapter = Exclude<HomeChapter, "hero">;

export const HOME_CHAPTER_BUDGETS_VH: Record<HomeChapter, number> = {
  hero: 205,
  marketplace: 235,
  preparation: 120,
  journey: 320,
  freight: 205,
  finale: 150,
};

export const HOME_MOBILE_CHAPTER_BUDGETS_VH: Record<HomeChapter, number> = {
  hero: 260,
  marketplace: 100,
  preparation: 105,
  journey: 260,
  freight: 208,
  finale: 150,
};

export type HomeMobilePolicy = "document" | "native-snap" | "sticky";

export const HOME_MOBILE_POLICY: Record<HomeChapter, HomeMobilePolicy> = {
  hero: "document",
  marketplace: "native-snap",
  preparation: "document",
  journey: "sticky",
  freight: "sticky",
  finale: "sticky",
};

export function marketplaceBudgetVh(categoryCount: number): number {
  const visibleCategoryCount = Math.min(6, Math.max(3, categoryCount));
  return Math.min(245, Math.max(220, 190 + visibleCategoryCount * 9));
}

export function chapterBudgetVh(chapter: HomeChapter, categoryCount = 5): number {
  return chapter === "marketplace"
    ? marketplaceBudgetVh(categoryCount)
    : HOME_CHAPTER_BUDGETS_VH[chapter];
}

export function mobileChapterBudgetVh(chapter: HomeChapter): number {
  return chapter === "marketplace"
    ? 100
    : HOME_MOBILE_CHAPTER_BUDGETS_VH[chapter];
}
