import { type NextRequest } from "next/server";
import { adminOfferAction } from "@/lib/catalog/catalog-route-handlers";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return adminOfferAction(request, (await params).id, "request-changes"); }

