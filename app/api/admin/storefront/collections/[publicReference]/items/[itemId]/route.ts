import { type NextRequest } from "next/server";
import { collectionUpdateItem } from "@/lib/storefront/storefront-admin-route-handlers";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ publicReference: string; itemId: string }> }) { const value = await params; return collectionUpdateItem(request, value.publicReference, value.itemId); }
