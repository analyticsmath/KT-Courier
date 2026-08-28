export interface HomeMediaItem {
  src: string;
  alt: string;
  objectPosition?: string;
  profile?: "hero" | "category" | "large" | "alpha";
}

export const homeMedia = {
  worldMarket: {
    src: "/media/public/home/kt-home-01-world-market.webp",
    alt: "Vibrant Johannesburg Sunday Market with local traders and shoppers",
    objectPosition: "50% 48%",
    profile: "hero",
  },
  retailLocal: {
    src: "/media/public/home/kt-home-02-retail-local.webp",
    alt: "Handcrafted local retail bags at a Johannesburg market stall",
    objectPosition: "50% 52%",
    profile: "category",
  },
  foodLocal: {
    src: "/media/public/home/kt-home-03-food-local.webp",
    alt: "Freshly prepared local market meals presented in wooden trays",
    objectPosition: "50% 52%",
    profile: "category",
  },
  grocery: {
    src: "/media/public/home/kt-home-04-grocery.webp",
    alt: "Fresh green and market produce display",
    objectPosition: "48% 50%",
    profile: "category",
  },
  fashion: {
    src: "/media/public/home/kt-home-05-fashion.webp",
    alt: "Curated editorial fashion accessories and handbag arrangement",
    objectPosition: "50% 48%",
    profile: "category",
  },
  fashionCutout: {
    src: "/media/public/home/kt-home-05-fashion-cutout.webp",
    alt: "Isolated fashion accessory arrangement",
    profile: "alpha",
  },
  wellness: {
    src: "/media/public/home/kt-home-06-wellness.webp",
    alt: "Amber glass skincare bottles and apothecary still life",
    objectPosition: "50% 50%",
    profile: "category",
  },
  wellnessCutout: {
    src: "/media/public/home/kt-home-06-wellness-cutout.webp",
    alt: "Isolated skincare glass bottle cluster",
    profile: "alpha",
  },
  homeware: {
    src: "/media/public/home/kt-home-07-homeware.webp",
    alt: "Ceramic homeware still life and decor",
    objectPosition: "50% 50%",
    profile: "category",
  },
  merchantPrepare: {
    src: "/media/public/home/kt-home-08-merchant-prepare.webp",
    alt: "Local maker carefully packing finished goods into a shipping box",
    objectPosition: "50% 48%",
    profile: "large",
  },
  packageDetail: {
    src: "/media/public/home/kt-home-09-package-detail.webp",
    alt: "Close-up of branded packaged order with thank you note inside",
    objectPosition: "50% 50%",
    profile: "category",
  },
  handoff: {
    src: "/media/public/home/kt-home-10-handoff.webp",
    alt: "Close-up handoff of delivery package between courier and recipient",
    objectPosition: "50% 50%",
    profile: "large",
  },
  routeCity: {
    src: "/media/public/home/kt-home-11-route-city.webp",
    alt: "Johannesburg city skyline and urban road corridor",
    objectPosition: "50% 50%",
    profile: "large",
  },
  routeRoad: {
    src: "/media/public/home/kt-home-12-route-road.webp",
    alt: "Transit road velocity along William Nicol corridor",
    objectPosition: "50% 50%",
    profile: "large",
  },
  arrival: {
    src: "/media/public/home/kt-home-13-arrival.webp",
    alt: "Physical handoff and verified arrival of packaged goods to recipient",
    objectPosition: "50% 50%",
    profile: "large",
  },
  motionOrderState: {
    src: "/media/public/motion/kt-motion-order-state.svg",
    alt: "Order preparation and transit state animation",
  },
  motionRouteLocation: {
    src: "/media/public/motion/kt-motion-route-location.svg",
    alt: "Route path and destination pin indicator",
  },
  motionArrival: {
    src: "/media/public/motion/kt-motion-arrival.svg",
    alt: "Delivery arrival confirmation animation",
  },
} as const;
