import type { HeroMotionTreatment } from "@/lib/public-assets/homepage-media";

export type HomepageMotionControllerProps = {
  rootId: string;
  heroTreatment?: HeroMotionTreatment;
};

export type HeroMotionElements = {
  scene: HTMLElement;
  pinStage: HTMLElement;
  environment: HTMLElement;
  route: SVGSVGElement;
  routePath: SVGPathElement;
  routeCheckpoints: SVGCircleElement[];
  truckShadow: HTMLElement;
  truck: HTMLElement;
  copy: HTMLElement;
  command: HTMLElement;
  handoff: HTMLElement;
};
