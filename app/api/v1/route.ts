import { handlePublicApi } from "@/lib/developer-api/gateway";
export const runtime = "nodejs";
export async function GET(request: Request) { return handlePublicApi(request); }
