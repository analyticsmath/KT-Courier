import { handleDeveloperAdminApi } from "@/lib/developer-api/session-gateway";
export const runtime = "nodejs";
type Context = { params: Promise<{ segments: string[] }> };
export async function GET(request: Request, context: Context) { return handleDeveloperAdminApi(request, (await context.params).segments); }
export async function POST(request: Request, context: Context) { return handleDeveloperAdminApi(request, (await context.params).segments); }
