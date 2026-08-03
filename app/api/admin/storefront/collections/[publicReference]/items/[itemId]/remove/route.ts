import { type NextRequest } from "next/server";
import { collectionRemoveItem } from "@/lib/storefront/storefront-admin-route-handlers";
export async function POST(request: NextRequest, { params }: { params: Promise<{ publicReference: string; itemId: string }> }) { const value = await params; return collectionRemoveItem(request, value.publicReference, value.itemId); }
