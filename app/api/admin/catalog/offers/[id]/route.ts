import { type NextRequest } from "next/server";
import { adminOfferGet } from "@/lib/catalog/catalog-route-handlers";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return adminOfferGet(request, (await params).id); }

