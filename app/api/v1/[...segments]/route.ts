import { handlePublicApi } from "@/lib/developer-api/gateway";
export const runtime = "nodejs";
type Context = { params: Promise<{ segments: string[] }> };
export async function GET(request: Request, context: Context) { return handlePublicApi(request, (await context.params).segments); }
export async function POST(request: Request, context: Context) { return handlePublicApi(request, (await context.params).segments); }
export async function PATCH(request: Request, context: Context) { return handlePublicApi(request, (await context.params).segments); }
export async function DELETE(request: Request, context: Context) { return handlePublicApi(request, (await context.params).segments); }
