import gsap from "gsap";
import { SplitText } from "gsap/SplitText";

/** Animate section boundaries without translating ancestors of pinned scenes. */
export function createSectionChoreography(root: HTMLElement) {
  const dispose: Array<() => void> = [];
  root
    .querySelectorAll<HTMLElement>("[data-section-transition]")
    .forEach((section) => {
      const direction = section.dataset.sectionTransition;
      const from =
        direction === "sweep"
          ? "polygon(0% 100px, 100% 0px, 100% 100%, 0% 100%)"
          : direction === "open"
            ? "inset(65px 5% 0px 5% round 32px)"
            : "inset(85px 0% 0px 0% round 0px)";
      const to =
        direction === "sweep"
          ? "polygon(0% 0px, 100% 0px, 100% 100%, 0% 100%)"
          : "inset(0px 0% 0px 0% round 0px)";
      const tween = gsap.fromTo(
        section,
        { clipPath: from },
        {
          clipPath: to,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top 96%",
            end: "top 42%",
            scrub: 0.65,
            invalidateOnRefresh: true,
          },
          onComplete: () => {
            section.style.removeProperty("clip-path");
          },
        },
      );
      const revealForFocus = () => {
        tween.progress(1);
        tween.scrollTrigger?.kill();
        section.style.removeProperty("clip-path");
      };
      section.addEventListener("focusin", revealForFocus);
      dispose.push(() =>
        section.removeEventListener("focusin", revealForFocus),
      );
    });
  root
    .querySelectorAll<HTMLElement>("[data-split-heading]")
    .forEach((heading) => {
      const split = SplitText.create(heading, {
        type: "lines",
        mask: "lines",
        autoSplit: true,
        aria: "auto",
        onSplit(self) {
          return gsap.from(self.lines, {
            yPercent: 115,
            rotation: 1.5,
            opacity: 0,
            duration: 1.05,
            stagger: 0.13,
            ease: "power4.out",
            scrollTrigger: { trigger: heading, start: "top 91%", once: true },
          });
        },
      });
      dispose.push(() => split.revert());
    });
  root
    .querySelectorAll<HTMLElement>("[data-text-scrub]")
    .forEach((paragraph) => {
      const split = SplitText.create(paragraph, {
        type: "words",
        aria: "auto",
        onSplit(self) {
          return gsap.from(self.words, {
            opacity: 0.25,
            stagger: 0.08,
            ease: "none",
            scrollTrigger: {
              trigger: paragraph,
              start: "top 88%",
              end: "bottom 58%",
              scrub: 0.5,
            },
          });
        },
      });
      dispose.push(() => split.revert());
    });
  root
    .querySelectorAll<HTMLElement>("[data-media-aperture]")
    .forEach((media) => {
      gsap.fromTo(
        media,
        { clipPath: "inset(14% 12% 14% 12% round 70px)" },
        {
          clipPath: "inset(0% 0% 0% 0% round 0px)",
          ease: "none",
          scrollTrigger: {
            trigger: media,
            start: "top 94%",
            end: "top 24%",
            scrub: 0.7,
          },
        },
      );
    });
  root
    .querySelectorAll<HTMLElement>("[data-process-sequence]")
    .forEach((process) => {
      const points = process.querySelectorAll<HTMLElement>(".kt-process-point");
      points.forEach((point) => {
        gsap.from(point, {
          x: 35,
          opacity: 0.2,
          ease: "none",
          scrollTrigger: {
            trigger: point,
            start: "top 90%",
            end: "top 55%",
            scrub: 0.5,
          },
        });
      });
    });
  const montage = root.querySelector<HTMLElement>("[data-montage]");
  if (montage) {
    const photo = montage.querySelector(".kt-montage-main");
    if (photo)
      gsap.to(photo, {
        clipPath: "inset(7% 8% 7% 8% round 28px)",
        ease: "none",
        scrollTrigger: {
          trigger: montage,
          start: "bottom 85%",
          end: "bottom 20%",
          scrub: 0.7,
        },
      });
  }
  root.querySelectorAll<HTMLElement>("[data-service-index]").forEach((row) => {
    const entrance = gsap.from(row, {
      x: 45,
      opacity: 0.25,
      ease: "none",
      scrollTrigger: {
        trigger: row,
        start: "top 94%",
        end: "top 60%",
        scrub: 0.45,
      },
    });
    const show = () => {
      entrance.progress(1);
      entrance.scrollTrigger?.kill();
    };
    row.addEventListener("focusin", show);
    dispose.push(() => row.removeEventListener("focusin", show));
  });
  root
    .querySelectorAll<HTMLElement>("[data-footer-directory] nav")
    .forEach((group, index) => {
      gsap.from(group, {
        y: 40,
        opacity: 0,
        duration: 0.8,
        delay: index * 0.08,
        ease: "power3.out",
        scrollTrigger: {
          trigger: group,
          start: "top 95%",
          once: true,
        },
      });
    });
  return () => dispose.forEach((clean) => clean());
}
