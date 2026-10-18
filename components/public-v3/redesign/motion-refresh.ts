import { ScrollTrigger } from "gsap/ScrollTrigger";

let pending = 0;
/** Coalesce font, route and media changes after every page's pins have mounted. */
export function refreshPublicMotion() {
  if (pending) cancelAnimationFrame(pending);
  pending = requestAnimationFrame(() => {
    pending = requestAnimationFrame(() => {
      pending = 0;
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
    });
  });
}
