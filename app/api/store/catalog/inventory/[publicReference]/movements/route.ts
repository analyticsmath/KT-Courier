import { type NextRequest } from "next/server";
import { storeInventoryMovementPost } from "@/lib/catalog/catalog-route-handlers";
export async function POST(request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) { return storeInventoryMovementPost(request, (await params).publicReference); }

