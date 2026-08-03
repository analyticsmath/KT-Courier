import { gsap } from "gsap";
import { homepageMotionSelectors } from "./motion-selectors";

/** Reveals only the documentary introduction; the native rail itself is never animated. */
export function createSecondaryMotion(root: HTMLElement) {
  const documentaryEntry = root.querySelector<HTMLElement>(homepageMotionSelectors.documentary.entry);
  if (!documentaryEntry) return;

  const heading = documentaryEntry.querySelector<HTMLElement>(homepageMotionSelectors.documentary.heading);
  const line = documentaryEntry.querySelector<SVGElement>(homepageMotionSelectors.documentary.line);
  const targets = [heading, line].filter((element): element is HTMLElement | SVGElement => Boolean(element));

  if (targets.length === 0) return;

  gsap.fromTo(
    targets,
    { autoAlpha: 0, y: 16 },
    {
      autoAlpha: 1,
      y: 0,
      duration: 0.55,
      ease: "power2.out",
      stagger: 0.08,
      scrollTrigger: {
        id: "kt-r5-documentary-reveal",
        trigger: documentaryEntry,
        start: "top 82%",
        toggleActions: "play none none none",
      },
    },
  );
}
