import { type NextRequest } from "next/server";
import { collectionAddItem } from "@/lib/storefront/storefront-admin-route-handlers";
export async function POST(request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) { return collectionAddItem(request, (await params).publicReference); }
