import { checkInfrastructureReadiness } from "@/lib/health/infrastructure-readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Railway-compatible healthcheck URL. Infrastructure-only, not payment approval. */
export async function GET() {
  const state = await checkInfrastructureReadiness();
  return Response.json(state, {
    status: state.status === "ready" ? 200 : 503,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
