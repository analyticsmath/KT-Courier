import { type NextRequest } from "next/server";
import { adminProductGet } from "@/lib/catalog/catalog-route-handlers";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return adminProductGet(request, (await params).id); }

