import { type NextRequest } from "next/server";
import { storeProductAction } from "@/lib/catalog/catalog-route-handlers";
export async function POST(request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) { return storeProductAction(request, (await params).publicReference, "archive"); }

