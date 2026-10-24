import { checkInfrastructureReadiness } from "@/lib/health/infrastructure-readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Railway deployment probe only. This does NOT authorise checkout or payouts. */
export async function GET() {
  const state = await checkInfrastructureReadiness();
  return Response.json(state, {
    status: state.status === "ready" ? 200 : 503,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
