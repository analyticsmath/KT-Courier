const publicRoots = new Set([
  "about",
  "services",
  "coverage-areas",
  "contact",
  "join",
  "careers",
  "faq",
  "safety",
  "accessibility",
  "privacy-policy",
  "terms",
  "refund-policy",
  "shipping-policy",
  "quote",
  "track",
]);
/** Only public editorial destinations take the cinematic route. Tasks/catalog stay immediate. */
export function isCinematicDestination(pathname: string) {
  return pathname === "/" || publicRoots.has(pathname.split("/")[1]);
}
export function routeMotionLabel(pathname: string) {
  if (pathname === "/") return "Good things. Going places.";
  if (pathname === "/services/parcel") return "Send a parcel.";
  if (pathname === "/services") return "The right delivery.";
  if (pathname.startsWith("/services/")) return "Let’s get it moving.";
  const labels: Record<string, string> = {
    "/about": "The people behind the parcel.",
    "/quote": "Your next delivery.",
    "/track": "Track your delivery.",
    "/contact": "Let’s talk.",
    "/coverage-areas": "Places we connect.",
    "/join": "Move with KT.",
    "/careers": "Your next move.",
  };
  return labels[pathname] ?? "KT Couriers.";
}
