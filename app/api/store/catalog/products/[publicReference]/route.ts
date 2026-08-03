import { type NextRequest } from "next/server";
import { storeProductGet, storeProductPatch } from "@/lib/catalog/catalog-route-handlers";
type Context = { params: Promise<{ publicReference: string }> };
export async function GET(request: NextRequest, { params }: Context) { return storeProductGet(request, (await params).publicReference); }
export async function PATCH(request: NextRequest, { params }: Context) { return storeProductPatch(request, (await params).publicReference); }

