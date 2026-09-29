export const HOME_CHAPTERS = ["hero", "commerce", "parcelization", "pickup", "network", "freight", "last-mile", "finale"] as const;
export type HomeChapter = (typeof HOME_CHAPTERS)[number];
export type PostHeroChapter = Exclude<HomeChapter, "hero">;
export type HomeMobilePolicy = "document" | "native-snap" | "sticky";
export const HOME_CHAPTER_BUDGETS_VH: Record<HomeChapter, number> = { hero: 205, commerce: 310, parcelization: 190, pickup: 230, network: 300, freight: 170, "last-mile": 370, finale: 130 };
export const HOME_MOBILE_CHAPTER_BUDGETS_VH: Record<HomeChapter, number> = { hero: 260, commerce: 230, parcelization: 155, pickup: 200, network: 250, freight: 155, "last-mile": 350, finale: 115 };
export const HOME_MOBILE_POLICY: Record<HomeChapter, HomeMobilePolicy> = { hero: "document", commerce: "native-snap", parcelization: "sticky", pickup: "sticky", network: "sticky", freight: "sticky", "last-mile": "sticky", finale: "sticky" };
export function commerceChapterBudgetVh(_storeCount = 0): number {
  void _storeCount; // Preserve the retired Store World caller signature.
  return HOME_CHAPTER_BUDGETS_VH.commerce;
}
/**
 * Authored still positions used when reduced motion is enabled. These are
 * deliberately inside reading holds so the page keeps its narrative content
 * without asking the visitor to watch a long sticky travel sequence.
 */
export const HOME_REDUCED_MOTION_PROGRESS: Record<PostHeroChapter, number> = {
  commerce: .79,
  parcelization: .85,
  pickup: .90,
  network: .78,
  freight: .35,
  "last-mile": .72,
  finale: .97,
};
export function reducedMotionChapterProgress(chapter: PostHeroChapter, _storeCount = 0): number {
  void _storeCount; // Retained for callers of the retired Store World resolver.
  return HOME_REDUCED_MOTION_PROGRESS[chapter];
}
export function chapterBudgetVh(chapter: HomeChapter): number { return HOME_CHAPTER_BUDGETS_VH[chapter]; }
export function mobileChapterBudgetVh(chapter: HomeChapter): number { return HOME_MOBILE_CHAPTER_BUDGETS_VH[chapter]; }
