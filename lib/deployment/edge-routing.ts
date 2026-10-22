/** Build-time routing authority. No caller-provided origin or Host header is trusted. */
export const PRODUCTION_EDGE_PROJECT = "prj_Q6i3g8JIv1ibkXGspPotBem2FFLD";
export const PRODUCTION_EDGE_ORIGIN = "https://kt-couriers-preproduction-web.onrender.com";

export type EdgeEnvironment = Readonly<Record<string, string | undefined>>;
export type StagingEdgeRegistration = Readonly<{
  projectId: string;
  origin: string;
  approvalRef: string;
}>;

// Empty until a separate project, spend authority and isolated origin are verified.
// Adding entries is an audited source change; an environment variable cannot widen it.
const APPROVED_STAGING: readonly StagingEdgeRegistration[] = [];

export function resolveEdgeOrigin(
  env: EdgeEnvironment,
  registrations: readonly StagingEdgeRegistration[] = APPROVED_STAGING,
): string | null {
  const onVercel = env.VERCEL === "1" || !!env.VERCEL_ENV || !!env.VERCEL_PROJECT_ID;
  if (!onVercel) return null; // Render/local app serves itself, with no external rewrite.

  if (env.VERCEL !== "1" || !env.VERCEL_PROJECT_ID) {
    throw new Error("EDGE_ISOLATION: missing Vercel deployment identity; build refused.");
  }
  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_ID === PRODUCTION_EDGE_PROJECT) {
    if (env.KT_EDGE_ROLE !== "production") {
      throw new Error("EDGE_ISOLATION: production routing requires explicit production role.");
    }
    return PRODUCTION_EDGE_ORIGIN;
  }
  // Even a preview of the production project must never inherit its origin/credentials.
  if (env.VERCEL_PROJECT_ID === PRODUCTION_EDGE_PROJECT || env.KT_EDGE_ROLE !== "staging" ||
      !["preview", "production"].includes(env.VERCEL_ENV ?? "")) {
    throw new Error("EDGE_ISOLATION: nonproduction deployment is not registered; build refused.");
  }
  const registration = registrations.find(row => row.projectId === env.VERCEL_PROJECT_ID);
  if (!registration?.approvalRef) {
    throw new Error("EDGE_ISOLATION: staging approval and origin are absent; build refused.");
  }
  const origin = new URL(registration.origin);
  if (origin.protocol !== "https:" || origin.origin !== registration.origin || origin.username || origin.password ||
      origin.hostname === new URL(PRODUCTION_EDGE_ORIGIN).hostname || origin.hostname === "ktcouriers.com" ||
      origin.hostname.endsWith(".ktcouriers.com") || !origin.hostname.endsWith(".up.railway.app")) {
    throw new Error("EDGE_ISOLATION: unsafe staging origin; build refused.");
  }
  // The actual staging app must pass staging:preflight before an entry is admitted.
  return origin.origin;
}

export function edgeRewrites(origin: string | null) {
  return { beforeFiles: origin ? [{ source: "/:path*", destination: `${origin}/:path*` }] : [], afterFiles: [], fallback: [] };
}
