import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/** Hold the outgoing chapter only after its final content reaches the viewport. */
export function createChapterTakeovers(root: HTMLElement) {
  const cleanups: Array<() => void> = [];
  if (!window.matchMedia("(min-width: 1000px) and (min-height: 520px)").matches)
    return () => {};
  root
    .querySelectorAll<HTMLElement>("[data-chapter-takeover]")
    .forEach((incoming, index) => {
      const outgoing = incoming.previousElementSibling as HTMLElement | null;
      if (
        !outgoing ||
        outgoing.tagName !== "SECTION" ||
        outgoing.matches("[data-orbit-scene], [data-connections-scene]") ||
        outgoing.querySelector(
          "[data-connections-scene], [data-orbit-scene], form, [data-no-chapter-pin]",
        )
      )
        return;
      gsap.set(outgoing, { position: "relative", zIndex: index + 1 });
      gsap.set(incoming, { position: "relative", zIndex: index + 2 });
      const hold = ScrollTrigger.create({
        trigger: outgoing,
        start: "bottom bottom",
        endTrigger: incoming,
        end: "top 80px",
        pin: outgoing,
        pinSpacing: false,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      });
      const corner = incoming.dataset.sectionTransition === "soft" ? 18 : 38;
      const edge = gsap.fromTo(
        incoming,
        { borderTopLeftRadius: corner, borderTopRightRadius: corner },
        {
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          ease: "none",
          scrollTrigger: {
            trigger: incoming,
            start: "top bottom",
            end: "top 80px",
            scrub: 0.6,
          },
        },
      );
      const releaseForFocus = () => {
        hold.kill(true);
        edge.progress(1);
        edge.scrollTrigger?.kill();
      };
      incoming.addEventListener("focusin", releaseForFocus);
      outgoing.addEventListener("focusin", releaseForFocus);
      cleanups.push(() => {
        incoming.removeEventListener("focusin", releaseForFocus);
        outgoing.removeEventListener("focusin", releaseForFocus);
        hold.kill(true);
      });
    });
  return () => cleanups.forEach((clean) => clean());
}
