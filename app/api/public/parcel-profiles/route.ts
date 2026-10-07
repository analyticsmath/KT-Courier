import { publicParcelProfiles } from "@/lib/commercial/parcel-profiles";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(await publicParcelProfiles(), { headers: { "Cache-Control": "no-store" } });
}
