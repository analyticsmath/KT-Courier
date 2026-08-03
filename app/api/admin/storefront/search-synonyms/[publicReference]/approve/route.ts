import { type NextRequest } from "next/server";
import { synonymTransition } from "@/lib/storefront/storefront-admin-route-handlers";
export async function POST(request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) { return synonymTransition(request, (await params).publicReference, "approve"); }
