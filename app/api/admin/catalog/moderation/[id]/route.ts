import { type NextRequest } from "next/server";
import { adminModerationGet } from "@/lib/catalog/catalog-route-handlers";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { return adminModerationGet(request, (await params).id); }

