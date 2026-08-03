import { type NextRequest } from "next/server";
import { adminProductTypeGet, adminProductTypePatch } from "@/lib/catalog/catalog-route-handlers";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, { params }: Context) { return adminProductTypeGet(request, (await params).id); }
export async function PATCH(request: NextRequest, { params }: Context) { return adminProductTypePatch(request, (await params).id); }

