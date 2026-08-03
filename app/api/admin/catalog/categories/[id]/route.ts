import { type NextRequest } from "next/server";
import { adminCategoryGet, adminCategoryPatch } from "@/lib/catalog/catalog-route-handlers";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, { params }: Context) { return adminCategoryGet(request, (await params).id); }
export async function PATCH(request: NextRequest, { params }: Context) { return adminCategoryPatch(request, (await params).id); }

