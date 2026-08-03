import { type NextRequest } from "next/server";
import { collectionTransition } from "@/lib/storefront/storefront-admin-route-handlers";
export async function POST(request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) { return collectionTransition(request, (await params).publicReference, "retire"); }
