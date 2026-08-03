import { type NextRequest } from "next/server";
import { projectionResolve } from "@/lib/storefront/storefront-admin-route-handlers";
export async function POST(request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) { return projectionResolve(request, (await params).publicReference); }
