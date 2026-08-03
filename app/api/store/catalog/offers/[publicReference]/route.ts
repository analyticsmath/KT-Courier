import { type NextRequest } from "next/server";
import { storeOfferGet, storeOfferPatch } from "@/lib/catalog/catalog-route-handlers";
type Context = { params: Promise<{ publicReference: string }> };
export async function GET(request: NextRequest, { params }: Context) { return storeOfferGet(request, (await params).publicReference); }
export async function PATCH(request: NextRequest, { params }: Context) { return storeOfferPatch(request, (await params).publicReference); }

