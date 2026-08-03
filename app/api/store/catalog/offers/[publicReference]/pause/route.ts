import { type NextRequest } from "next/server";
import { storeOfferAction } from "@/lib/catalog/catalog-route-handlers";
export async function POST(request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) { return storeOfferAction(request, (await params).publicReference, "pause"); }

