export const HOME_CHAPTERS = ["hero", "commerce", "parcelization", "network", "freight", "last-mile", "finale"] as const;
export type HomeChapter = (typeof HOME_CHAPTERS)[number];
export type PostHeroChapter = Exclude<HomeChapter, "hero">;
export type HomeMobilePolicy = "document" | "native-snap" | "sticky";
export const HOME_CHAPTER_BUDGETS_VH: Record<HomeChapter, number> = { hero: 205, commerce: 280, parcelization: 160, network: 250, freight: 240, "last-mile": 340, finale: 135 };
export const HOME_MOBILE_CHAPTER_BUDGETS_VH: Record<HomeChapter, number> = { hero: 260, commerce: 0, parcelization: 135, network: 190, freight: 190, "last-mile": 290, finale: 125 };
export const HOME_MOBILE_POLICY: Record<HomeChapter, HomeMobilePolicy> = { hero: "document", commerce: "native-snap", parcelization: "document", network: "sticky", freight: "sticky", "last-mile": "sticky", finale: "sticky" };
export function commerceChapterBudgetVh(storeCount = 0): number { return storeCount >= 3 ? 330 : 280; }
/**
 * Authored still positions used when reduced motion is enabled. These are
 * deliberately inside reading holds so the page keeps its narrative content
 * without asking the visitor to watch a long sticky travel sequence.
 */
export const HOME_REDUCED_MOTION_PROGRESS: Record<PostHeroChapter, number> = {
  commerce: .74,
  parcelization: .6,
  network: .78,
  freight: .35,
  "last-mile": .77,
  finale: .97,
};
export function reducedMotionChapterProgress(chapter: PostHeroChapter, storeCount = 0): number {
  if (chapter === "commerce" && storeCount < 3) return .88;
  return HOME_REDUCED_MOTION_PROGRESS[chapter];
}
export function chapterBudgetVh(chapter: HomeChapter): number { return HOME_CHAPTER_BUDGETS_VH[chapter]; }
export function mobileChapterBudgetVh(chapter: HomeChapter): number { return HOME_MOBILE_CHAPTER_BUDGETS_VH[chapter]; }
