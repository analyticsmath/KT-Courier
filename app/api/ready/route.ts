import { checkReadiness } from "@/lib/health/checks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const payload = await checkReadiness();
  return Response.json(payload, {
    status: payload.status === "ready" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
