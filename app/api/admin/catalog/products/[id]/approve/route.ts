import { type NextRequest } from "next/server";
import { adminProductAction } from "@/lib/catalog/catalog-route-handlers";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return adminProductAction(request, (await params).id, "approve"); }

