import { type NextRequest } from "next/server";
import { adminProductTypeAction } from "@/lib/catalog/catalog-route-handlers";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return adminProductTypeAction(request, (await params).id, "retire"); }

