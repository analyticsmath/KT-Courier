import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { refreshPublicMotion } from "../redesign/motion-refresh";

export function createHeroEntrance(root: HTMLElement) {
  const title = root.querySelector<HTMLElement>("[data-wave-title]");
  const frame = root.querySelector<HTMLElement>("[data-hero-window]");
  const hero = title?.closest("section");
  if (!title || !frame || !hero) return () => {};
  gsap.registerPlugin(SplitText);
  const split = SplitText.create(Array.from(title.children), {
    type: "chars",
    mask: "chars",
    charsClass: "kt-hero-char",
    aria: "auto",
  });
  const entrance = gsap
    .timeline({ paused: true, onComplete: refreshPublicMotion })
    .fromTo(
      split.chars,
      {
        yPercent: (i: number) => 110 + (i % 5) * 12,
        rotation: (i: number) => ((i % 4) - 1.5) * 3,
      },
      {
        yPercent: 0,
        rotation: 0,
        duration: 1.05,
        stagger: 0.022,
        ease: "power4.out",
      },
      0,
    )
    .fromTo(
      frame,
      {
        y: 85,
        scale: 0.94,
        rotation: 1.5,
        clipPath: "inset(18% 5% 0% 5% round 60px)",
      },
      {
        y: 0,
        scale: 1,
        rotation: 0,
        clipPath: "inset(0% 0% 0% 0% round 0px)",
        duration: 1.35,
        ease: "power4.out",
      },
      0.16,
    )
    .fromTo(
      root.querySelector("[data-hero-intro]"),
      { y: 25, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
      0.5,
    );
  let started = false;
  const play = () => {
    if (!started) {
      started = true;
      entrance.play();
    }
  };
  const finish = () => {
    started = true;
    entrance.progress(1).pause();
  };
  window.addEventListener("kt:opening-reveal", play);
  window.addEventListener("kt:opening-complete", play);
  hero.addEventListener("focusin", finish);
  const fallback = setTimeout(play, 2800);
  return () => {
    clearTimeout(fallback);
    window.removeEventListener("kt:opening-reveal", play);
    window.removeEventListener("kt:opening-complete", play);
    hero.removeEventListener("focusin", finish);
    entrance.kill();
    split.revert();
  };
}
