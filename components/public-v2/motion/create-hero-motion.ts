import { gsap } from "gsap";
import { heroMotionConfig, getDesktopHeroScrollDistance } from "./hero-motion-config";
import type { HeroMotionElements } from "./motion-types";

function prepareHeroLayers(elements: HeroMotionElements) {
  gsap.set(
    [elements.environment, elements.truckShadow, elements.truck, elements.copy, elements.handoff],
    { willChange: "transform, opacity" },
  );
  gsap.set(elements.routePath, { willChange: "stroke-dashoffset" });
  gsap.set(elements.route, { "--kt-route-progress": 0 });
  gsap.set(elements.routeCheckpoints, { opacity: 0.72, transformOrigin: "50% 50%" });
}

export function createDesktopHeroMotion(elements: HeroMotionElements) {
  const config = heroMotionConfig.desktop;

  prepareHeroLayers(elements);

  return gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      id: "kt-r5-hero",
      trigger: elements.scene,
      start: "top top",
      end: () => `+=${getDesktopHeroScrollDistance(window.innerHeight)}`,
      pin: elements.pinStage,
      pinSpacing: true,
      scrub: config.scrub,
      invalidateOnRefresh: true,
    },
  })
    .addLabel("arrival", 0)
    .to(
      elements.environment,
      {
        "--kt-environment-y": "-0.5vh",
        "--kt-environment-scale": 1.008,
        duration: 0.12,
      },
      "arrival",
    )
    .to(
      elements.truckShadow,
      { "--kt-shadow-y": "-1px", "--kt-shadow-scale": 0.99, opacity: 0.96, duration: 0.12 },
      "arrival",
    )
    .addLabel("routeAwakens", 0.1)
    .to(elements.route, { "--kt-route-progress": 1, duration: 0.2 }, "routeAwakens")
    .to(elements.routeCheckpoints.slice(0, 2), { opacity: 1, scale: 1.08, duration: 0.1 }, "routeAwakens+=0.09")
    .to(elements.routeCheckpoints.slice(0, 2), { scale: 1, duration: 0.1 }, "routeAwakens+=0.19")
    .addLabel("cameraTracks", 0.28)
    .to(
      elements.environment,
      {
        "--kt-environment-y": config.environmentY,
        "--kt-environment-scale": config.environmentScale,
        duration: 0.34,
      },
      "cameraTracks",
    )
    .to(
      elements.truck,
      {
        "--kt-truck-x": config.truckX,
        "--kt-truck-y": config.truckY,
        "--kt-truck-scale": config.truckScale,
        "--kt-truck-rotate": config.truckRotate,
        duration: 0.34,
      },
      "cameraTracks",
    )
    .to(
      elements.truckShadow,
      {
        "--kt-shadow-x": config.shadowX,
        "--kt-shadow-y": config.shadowY,
        "--kt-shadow-scale": config.shadowScale,
        opacity: 0.88,
        duration: 0.34,
      },
      "cameraTracks",
    )
    .to(
      elements.copy,
      { y: config.copyY, "--kt-copy-opacity": config.copyOpacity, duration: 0.34 },
      "cameraTracks",
    )
    .addLabel("handoff", 0.64)
    .to(elements.handoff, { y: -6, opacity: 0.76, duration: 0.24 }, "handoff")
    .addLabel("release", 0.88)
    .to(elements.handoff, { y: -4, opacity: 0.84, duration: 0.12 }, "release");
}

export function createTabletHeroMotion(elements: HeroMotionElements) {
  const config = heroMotionConfig.tablet;

  prepareHeroLayers(elements);

  return gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      id: "kt-r5-hero-tablet",
      trigger: elements.scene,
      start: "top 78%",
      end: "bottom 35%",
      scrub: config.scrub,
      invalidateOnRefresh: true,
    },
  })
    .to(elements.route, { "--kt-route-progress": 1, duration: 0.24 }, 0)
    .to(
      elements.environment,
      {
        "--kt-environment-y": config.environmentY,
        "--kt-environment-scale": config.environmentScale,
        duration: 0.4,
      },
      0.08,
    )
    .to(
      elements.truck,
      {
        "--kt-truck-x": config.truckX,
        "--kt-truck-y": config.truckY,
        "--kt-truck-scale": config.truckScale,
        duration: 0.4,
      },
      0.08,
    )
    .to(
      elements.truckShadow,
      {
        "--kt-shadow-x": config.shadowX,
        "--kt-shadow-y": config.shadowY,
        "--kt-shadow-scale": config.shadowScale,
        opacity: 0.94,
        duration: 0.4,
      },
      0.08,
    )
    .to(elements.copy, { y: config.copyY, "--kt-copy-opacity": config.copyOpacity, duration: 0.36 }, 0.12);
}
