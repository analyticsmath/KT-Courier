import { openApiJson } from "@/lib/developer-api/openapi";
export const dynamic = "force-static";
export async function GET() { return new Response(openApiJson(), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=3600" } }); }
