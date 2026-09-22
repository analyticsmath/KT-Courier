export const HOME_CHAPTERS = ["hero", "commerce", "parcelization", "network", "freight", "last-mile", "finale"] as const;
export type HomeChapter = (typeof HOME_CHAPTERS)[number];
export type PostHeroChapter = Exclude<HomeChapter, "hero">;
export type HomeMobilePolicy = "document" | "native-snap" | "sticky";
export const HOME_CHAPTER_BUDGETS_VH: Record<HomeChapter, number> = { hero: 205, commerce: 325, parcelization: 135, network: 280, freight: 215, "last-mile": 340, finale: 150 };
export const HOME_MOBILE_CHAPTER_BUDGETS_VH: Record<HomeChapter, number> = { hero: 260, commerce: 250, parcelization: 115, network: 225, freight: 185, "last-mile": 310, finale: 150 };
export const HOME_MOBILE_POLICY: Record<HomeChapter, HomeMobilePolicy> = { hero: "document", commerce: "native-snap", parcelization: "document", network: "sticky", freight: "sticky", "last-mile": "sticky", finale: "sticky" };
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
