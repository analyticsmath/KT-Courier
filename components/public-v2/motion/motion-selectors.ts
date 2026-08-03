export const homepageMotionSelectors = {
  root: '[data-kt-homepage="v2"]',
  hero: {
    scene: '[data-kt-motion-scene="hero"]',
    pinStage: '[data-kt-motion-pin="hero-stage"]',
    startAnchor: '[data-kt-motion-anchor="hero-start"]',
    exitAnchor: '[data-kt-motion-anchor="hero-exit"]',
    environment: '[data-kt-motion-layer="environment"]',
    route: '[data-kt-motion-layer="route"]',
    routePath: '[data-kt-motion-segment="hero"] [data-kt-route-path]',
    routeCheckpoints: '[data-kt-motion-segment="hero"] [data-kt-route-checkpoint]',
    truckShadow: '[data-kt-motion-layer="truck-shadow"]',
    truck: '[data-kt-motion-layer="truck"]',
    copy: '[data-kt-motion-layer="copy"]',
    command: '[data-kt-motion-layer="command"]',
    handoff: "[data-kt-motion-handoff]",
  },
  documentary: {
    entry: '[data-kt-motion-anchor="documentary-entry"]',
    heading: '[data-kt-motion-reveal="heading"]',
    line: '[data-kt-motion-reveal="line"]',
  },
} as const;
